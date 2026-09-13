#!/usr/bin/env python3
"""Inject a GPS track into a Zepp OS simulator device image.

The emulator feeds the Geolocation sensor from the NMEA log stored in
/virtual_sensor_data/fake_data_gps.dat inside the device's FAT16 norflash.bin.
Replacing that file makes the watch report our coordinates; the mini program
just uses the normal @zos/sensor Geolocation API and is unaware of the mock.

Usage:
  set_gps.py --model "GTS 4" --lat 48.5000 --lng 135.0979
  set_gps.py --model "Bip 6" --track "48.50,135.09 48.51,135.10" --speed-kmh 20
  set_gps.py --img ~/.zepp/emulator_cache/<id>/norflash.bin --lat .. --lng ..
  set_gps.py --model "GTS 4" --restore

Requires: mtools (mdir/mcopy/mdel).
"""

import argparse
import datetime
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.expanduser("~/.config/simulator/config.json")
CACHE = os.path.expanduser("~/.zepp/emulator_cache")
VENDOR_LIST = os.path.join(ROOT, "vendor", "emulatorList.json")

GSA = "GNGSA,A,3,06,07,09,11,16,19,23,25,,,,,1.34,0.94,0.95"
GSV = [
    "GPGSV,2,1,08,03,45,111,42,06,67,210,46,07,32,150,40,11,21,290,38",
    "GPGSV,2,2,08,16,55,045,44,19,24,120,39,23,12,310,35,25,08,080,33",
    "GLGSV,1,1,04,65,40,070,40,66,55,140,44,72,30,220,38,81,15,300,30",
]


def run_mtools(args, check=False):
    """Run mtools non-interactively (never block on a TTY prompt)."""
    env = dict(os.environ, MTOOLS_SKIP_CHECK="1", MTOOLS_EJECT="1")
    return subprocess.run(args, check=check, capture_output=True,
                          stdin=subprocess.DEVNULL, env=env)


def checksum(body):
    x = 0
    for ch in body:
        x ^= ord(ch)
    return f"{x:02X}"


def nmea(body):
    return f"${body}*{checksum(body)}\r\n"


def to_dm(deg, is_lat):
    hemi = ("N" if deg >= 0 else "S") if is_lat else ("E" if deg >= 0 else "W")
    d = int(abs(deg))
    m = (abs(deg) - d) * 60
    return f"{d:02d}{m:07.4f},{hemi}" if is_lat else f"{d:03d}{m:07.4f},{hemi}"


def hav(a, b):
    R = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = math.radians(b[0] - a[0])
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def bearing(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def read_header(img):
    """Return the $PAIR/$GNZDA preamble of the original GPS log (before $GNGGA)."""
    if not img or not os.path.exists(img):
        return []
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.close()
    try:
        run_mtools(["mcopy", "-o", "-i", img,
                        "::/virtual_sensor_data/fake_data_gps.dat", tmp.name], check=True)
        header = []
        with open(tmp.name, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                if line.startswith("$GNGGA"):
                    break
                if line.startswith("$"):
                    header.append(line.rstrip("\r\n"))
        return header
    except Exception:
        return []
    finally:
        os.unlink(tmp.name)


def build_lines(points, speed_kmh, seconds, date, start, header):
    lines = list(header)
    hh, mm, ss = map(int, start.split(":"))
    y_, m_, d_ = map(int, date.split("-"))
    t0 = datetime.datetime(y_, m_, d_, hh, mm, ss)
    spd_kn = speed_kmh / 1.852

    if len(points) == 1:
        lat, lon = points[0]
        seq = [(lat, lon, 0.0)] * seconds
    else:
        seq = []
        for i in range(len(points) - 1):
            A, B = points[i], points[i + 1]
            dist = hav(A, B)
            brg = bearing(A, B)
            n = max(1, int(dist / max(speed_kmh / 3.6, 0.1)))
            for k in range(n):
                fr = k / n
                seq.append((A[0] + (B[0] - A[0]) * fr,
                            A[1] + (B[1] - A[1]) * fr, brg))
        seq.append((points[-1][0], points[-1][1], 0.0))
        seq = seq[:seconds] if len(seq) > seconds else seq

    for i, (lat, lon, brg) in enumerate(seq):
        tt = (t0 + datetime.timedelta(seconds=i)).strftime("%H%M%S") + ".000"
        lines.append(nmea(GSA))
        lines.extend(nmea(g) for g in GSV)
        lines.append(nmea(f"GNGGA,{tt},{to_dm(lat, True)},{to_dm(lon, False)},1,9,0.94,45.0,M,-6.8,M,,"))
        lines.append(nmea(f"GNRMC,{tt},A,{to_dm(lat, True)},{to_dm(lon, False)},"
                          f"{spd_kn:.1f},{brg:.1f},{d_:02d}{m_:02d}{y_ % 100:02d},,,A"))
        lines.append(nmea(f"GNVTG,{brg:.1f},T,,M,{spd_kn:.1f},N,{speed_kmh:.1f},K,A"))
        lines.append(nmea(f"GNZDA,{tt},{d_:02d},{m_:02d},{y_:04d},,"))
    return lines


def resolve_img(model):
    cfg = {}
    if os.path.exists(CONFIG):
        with open(CONFIG, encoding="utf-8") as f:
            cfg = json.load(f)
    for p in json.loads(cfg.get("selectDeviceList") or "[]"):
        if p.get("modelName") == model:
            return os.path.join(CACHE, p["id"], "norflash.bin")
    if os.path.exists(VENDOR_LIST):
        with open(VENDOR_LIST, encoding="utf-8") as f:
            for e in json.load(f):
                if e.get("modelName") == model:
                    for r in e.get("released", []):
                        if r.get("code") == "1.1.0":
                            return os.path.join(CACHE, r["id"], "norflash.bin")
    return None


def inject(img, data_path):
    if not shutil.which("mcopy"):
        sys.exit("[gps] mtools not installed: sudo apt-get install -y mtools")
    run_mtools(["mdir", "-i", img, "::/virtual_sensor_data"], check=True)
    run_mtools(["mdel", "-i", img, "::/virtual_sensor_data/fake_data_gps.dat"])
    run_mtools(["mcopy", "-o", "-i", img, data_path,
                "::/virtual_sensor_data/fake_data_gps.dat"], check=True)
    out = run_mtools(["mdir", "-i", img,
                      "::/virtual_sensor_data/fake_data_gps.dat"]).stdout.decode("utf-8", "replace")
    print("[gps] injected;", out.strip().splitlines()[-2].strip() if out else "")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", help='device model name, e.g. "GTS 4" / "Bip 6"')
    ap.add_argument("--img", help="norflash.bin path (overrides --model)")
    ap.add_argument("--lat", type=float, help="latitude (DD)")
    ap.add_argument("--lng", type=float, help="longitude (DD)")
    ap.add_argument("--track", help='space-separated "lat,lon" waypoints')
    ap.add_argument("--random", type=int, metavar="N",
                    help="N random waypoints inside --bbox")
    ap.add_argument("--bbox", default="48.40,135.00,48.55,135.20",
                    help="lat0,lng0,lat1,lng1 for --random (default: Khabarovsk)")
    ap.add_argument("--speed-kmh", type=float, default=4.5)
    ap.add_argument("--seconds", type=int, default=3600, help="log length, 1 Hz")
    ap.add_argument("--date", default="2026-01-15")
    ap.add_argument("--start", default="02:00:00")
    ap.add_argument("--out", help="write NMEA here and stop (do not inject)")
    ap.add_argument("--restore", action="store_true", help="restore norflash.bin.bak")
    args = ap.parse_args()

    img = args.img or (resolve_img(args.model) if args.model else None)
    if not img:
        sys.exit("[gps] specify --img or a known --model")
    if not os.path.exists(img):
        sys.exit(f"[gps] image not found: {img}")

    if args.restore:
        bak = img + ".bak"
        if not os.path.exists(bak):
            sys.exit(f"[gps] no backup: {bak}")
        shutil.copyfile(bak, img)
        print(f"[gps] restored {img} from {bak}")
        return

    if args.track:
        pts = [tuple(map(float, w.split(","))) for w in args.track.split()]
    elif args.random:
        import random
        la0, lo0, la1, lo1 = map(float, args.bbox.split(","))
        pts = [(random.uniform(la0, la1), random.uniform(lo0, lo1))
               for _ in range(args.random)]
        print("[gps] random waypoints:", " ".join(f"{a:.5f},{b:.5f}" for a, b in pts))
    elif args.lat is not None and args.lng is not None:
        pts = [(args.lat, args.lng)]
    else:
        sys.exit("[gps] provide --lat/--lng or --track")

    header = read_header(img)
    lines = build_lines(pts, args.speed_kmh, args.seconds, args.date, args.start, header)

    tmp = args.out or tempfile.NamedTemporaryFile(
        delete=False, suffix=".nmea").name
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(lines))
    size = os.path.getsize(tmp)
    print(f"[gps] NMEA {size} bytes, {len(lines)} lines, header {len(header)} strings")

    if args.out:
        print(f"[gps] written {args.out}")
        return

    bak = img + ".bak"
    if not os.path.exists(bak):
        shutil.copyfile(img, bak)
        print(f"[gps] backup {bak}")
    inject(img, tmp)
    os.unlink(tmp)


if __name__ == "__main__":
    main()
