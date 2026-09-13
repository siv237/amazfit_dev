#!/usr/bin/env python3
"""Manage simulator devices from the project (portable).

Ensures a device image is present in ~/.zepp/emulator_cache and registered in
~/.config/simulator/config.json (selectDeviceList), so the project can be moved
to another machine and bootstrapped with one script.

Usage:
  sim_devices.py list
  sim_devices.py ensure "<modelName>" "<releaseCode>"
  sim_devices.py set-platform "<modelName>"

The emulator list is read from <repo>/vendor/emulatorList.json if present,
otherwise downloaded from the public CDN.
"""

import json
import os
import shutil
import struct
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.expanduser("~/.config/simulator/config.json")
CACHE = os.path.expanduser("~/.zepp/emulator_cache")
VENDOR_LIST = os.path.join(ROOT, "vendor", "emulatorList.json")
CDN = "https://upload-cdn.huami.com/zeppos/simulator/download/emulatorList.json"


def load_list():
    if not os.path.exists(VENDOR_LIST):
        os.makedirs(os.path.dirname(VENDOR_LIST), exist_ok=True)
        subprocess.run(["curl", "-s", CDN, "-o", VENDOR_LIST], check=True)
    with open(VENDOR_LIST, encoding="utf-8") as f:
        return json.load(f)


def find_release(lst, model, code=None):
    for e in lst:
        if e.get("modelName") == model:
            for r in e.get("released", []):
                if code is None or r.get("code") == code:
                    return e, r
    return None, None


def load_config():
    if not os.path.exists(CONFIG):
        os.makedirs(os.path.dirname(CONFIG), exist_ok=True)
        return {}
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def save_config(cfg):
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent="\t", ensure_ascii=False)


def is_downloaded(rid):
    return os.path.exists(os.path.join(CACHE, rid, "main.elf"))


def download(e, r, rid):
    os.makedirs(CACHE, exist_ok=True)
    zpath = os.path.join(CACHE, rid + ".zip")
    print(f"[devices] downloading {r['name']} ({r.get('fileSize', 0)} bytes)")
    subprocess.run(["curl", "-sL", "--max-time", "1200", "-o", zpath, r["filePath"]], check=True)
    with zipfile.ZipFile(zpath) as z:
        names = z.namelist()
        z.extractall(CACHE)
    top = [n.split("/")[0] for n in names if "/" in n][0]
    dst = os.path.join(CACHE, rid)
    if os.path.exists(dst):
        shutil.rmtree(dst)
    os.rename(os.path.join(CACHE, top), dst)
    os.remove(zpath)


def register(e, r):
    params = {
        "deviceImage": e["deviceImage"],
        "device": e["device"],
        "modelName": e["modelName"],
        "deviceLimit": e.get("limit"),
        **r,
        "status": 1,
        "process": 0,
    }
    cfg = load_config()
    cur = json.loads(cfg.get("selectDeviceList") or "[]")
    cur = [p for p in cur if p.get("id") != params["id"]]
    cur.append(params)
    cfg["selectDeviceList"] = json.dumps(cur)
    save_config(cfg)
    return params


def ensure(model, code=None):
    lst = load_list()
    e, r = find_release(lst, model, code)
    if not r:
        print(f"[devices] not found: {model} {code or ''}", file=sys.stderr)
        sys.exit(1)
    rid = r["id"]
    if not is_downloaded(rid):
        download(e, r, rid)
    params = register(e, r)
    print(f"[devices] {model} {r['code']} ready (id={rid[:8]}…)")
    return params


def set_platform(model):
    lst = load_list()
    e, r = find_release(lst, model)
    if not r:
        print(f"[devices] not found: {model}", file=sys.stderr)
        sys.exit(1)
    cfg = load_config()
    cfg["platform"] = r["id"]
    save_config(cfg)
    print(f"[devices] platform = {model} {r['code']} ({r['id'][:8]}…)")
    return r["id"]


def cmd_list():
    cfg = load_config()
    for p in json.loads(cfg.get("selectDeviceList") or "[]"):
        mark = "*" if p.get("id") == cfg.get("platform") else " "
        got = "ok" if is_downloaded(p.get("id")) else "missing"
        print(f" {mark} {p.get('modelName'):12} {p.get('code'):8} {got:8} {p.get('id')}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "list":
        cmd_list()
    elif cmd == "ensure":
        ensure(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    elif cmd == "set-platform":
        set_platform(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
