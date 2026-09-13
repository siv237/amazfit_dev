#!/usr/bin/env bash
#
# Launch a Zepp OS app on a chosen platform in the simulator.
#
# Interactive:
#   scripts/dev.sh
#
# Non-interactive:
#   scripts/dev.sh -p gts4 -a khabarovsk-bus      # install and return
#   scripts/dev.sh -p bip6 -a khabarovsk-bus --watch
#
# Flags:
#   -p, --platform  gts4 | bip6 (or "GTS 4" / "Bip 6")
#   -a, --app       app folder name under apps/<platform>/
#       --watch     keep zeus dev watching (default: install and return)
#       --gps "LAT,LNG"          mock a fixed position (optional)
#       --gps-track "LAT,LNG LAT,LNG ..."  mock a route (interpolated)
#       --gps-random [N]         N random waypoints inside --gps-bbox
#       --gps-bbox "la0,lo0,la1,lo1"       default: Khabarovsk
#       --gps-speed KMH          movement speed (default 4.5)
#       --gps-seconds N          log length, 1 Hz (default 3600)
#   -h, --help
#
# GPS is injected into the selected device's norflash.bin (fake_data_gps.dat)
# only when a --gps* flag is given.
#
# Everything lives in the repo (vendor/ + scripts/); device images are
# downloaded on demand into ~/.zepp/emulator_cache.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLATFORM_ARG=""
APP_ARG=""
WATCH=0
GPS_KIND=""
GPS_LAT=""
GPS_LNG=""
GPS_VALUE=""
GPS_SPEED=""
GPS_SECONDS=""

usage() {
  sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -p|--platform) PLATFORM_ARG="${2:-}"; shift 2 ;;
    -a|--app)      APP_ARG="${2:-}"; shift 2 ;;
    --no-watch)    WATCH=0; shift ;;
    --watch)       WATCH=1; shift ;;
    --gps)         GPS_KIND=static; GPS_LAT="${2%%,*}"; GPS_LNG="${2#*,}"; shift 2 ;;
    --gps-track)   GPS_KIND=track; GPS_VALUE="${2:-}"; shift 2 ;;
    --gps-random)  GPS_KIND=random
                   if [ "${2:-}" ] && [ "${2:-}" -eq "${2:-}" ] 2>/dev/null; then GPS_VALUE="$2"; shift 2; else GPS_VALUE=12; shift; fi ;;
    --gps-bbox)    GPS_BBOX="${2:-}"; shift 2 ;;
    --gps-speed)   GPS_SPEED="${2:-}"; shift 2 ;;
    --gps-seconds) GPS_SECONDS="${2:-}"; shift 2 ;;
    -h|--help)     usage 0 ;;
    *) echo "unknown option: $1" >&2; usage 1 ;;
  esac
done
GPS_BBOX="${GPS_BBOX:-48.40,135.00,48.55,135.20}"

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || true
fi
hash -r

# --- platform resolution ----------------------------------------------------
MODEL="" FOLDER="" ZEUS_NAME=""
case "$PLATFORM_ARG" in
  "") ;;
  gts4|"GTS 4"|"Amazfit GTS 4") MODEL="GTS 4"; FOLDER="gts4"; ZEUS_NAME="Amazfit GTS 4" ;;
  bip6|"Bip 6"|"Amazfit Bip 6") MODEL="Bip 6"; FOLDER="bip6"; ZEUS_NAME="Amazfit Bip 6" ;;
  *) echo "unknown platform: $PLATFORM_ARG (use gts4 or bip6)" >&2; exit 1 ;;
esac

if [ -z "$FOLDER" ]; then
  echo
  echo "Выбери платформу:"
  select CHOICE in "GTS 4" "Bip 6"; do
    case "${CHOICE:-}" in
      "GTS 4") MODEL="GTS 4"; FOLDER="gts4"; ZEUS_NAME="Amazfit GTS 4"; break ;;
      "Bip 6") MODEL="Bip 6"; FOLDER="bip6"; ZEUS_NAME="Amazfit Bip 6"; break ;;
      *) echo "неверный выбор" ;;
    esac
  done
fi

# --- 1. Network patch + mirror ----------------------------------------------
"$ROOT/scripts/patch-simulator.sh"

# --- 2. Device image + active platform --------------------------------------
echo "[dev] подготавливаю $MODEL ($ZEUS_NAME) — образ скачается при первом запуске"
python3 "$ROOT/scripts/sim_devices.py" ensure "$MODEL" 1.1.0
python3 "$ROOT/scripts/sim_devices.py" set-platform "$MODEL"

# default device for plain `zeus dev`/`build`
python3 - "$ZEUS_NAME" <<'PY'
import os, sys
p = os.path.expanduser("~/.zepp/.zeus")
key = "____zeus_development_device="
lines = open(p).read().splitlines() if os.path.exists(p) else []
out = [l for l in lines if not l.startswith(key)] + [key + sys.argv[1]]
open(p, "w").write("\n".join(out) + "\n")
PY

# --- 3. Restart simulator, detached (survives this script) -------------------
pkill -9 -x qemu-system-arm 2>/dev/null || true
pkill -9 -x simulator 2>/dev/null || true
sleep 2

# --- 3b. Inject mocked GPS (only when --gps* is given; image must be idle) ---
if [ -n "$GPS_KIND" ]; then
  for _ in $(seq 1 15); do pgrep -x qemu-system-arm >/dev/null || break; sleep 1; done
  GPS_ARGS=(--model "$MODEL")
  case "$GPS_KIND" in
    static) GPS_ARGS+=(--lat "$GPS_LAT" --lng "$GPS_LNG") ;;
    track)  GPS_ARGS+=(--track "$GPS_VALUE") ;;
    random) GPS_ARGS+=(--random "$GPS_VALUE" --bbox "$GPS_BBOX") ;;
  esac
  [ -n "$GPS_SPEED" ] && GPS_ARGS+=(--speed-kmh "$GPS_SPEED")
  [ -n "$GPS_SECONDS" ] && GPS_ARGS+=(--seconds "$GPS_SECONDS")
  echo "[dev] GPS: $GPS_KIND ${GPS_VALUE:-${GPS_LAT:+$GPS_LAT,$GPS_LNG}}"
  timeout 120 python3 -u "$ROOT/scripts/set_gps.py" "${GPS_ARGS[@]}" \
    || echo "[dev] ВНИМАНИЕ: GPS не применён (продолжаю без него)"
fi

LOG="${TMPDIR:-/tmp}/zepp-sim.log"
echo "[dev] запускаю симулятор (лог: $LOG)"
setsid "$ROOT/scripts/run-simulator.sh" >"$LOG" 2>&1 </dev/null &
disown || true

echo -n "[dev] жду симулятор"
up=0
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:7650/" 2>/dev/null; then up=1; break; fi
  echo -n "."; sleep 1
done
echo
[ "$up" = "1" ] || { echo "[dev] симулятор не поднялся, смотри $LOG"; exit 1; }

# --- 4. Press "Emulator" (retry) --------------------------------------------
clicked=0
for _ in $(seq 1 10); do
  if timeout 15 python3 "$ROOT/scripts/click_emulator.py"; then clicked=1; break; fi
  sleep 2
done
if [ "$clicked" = "1" ]; then
  echo "[dev] Emulator нажат"
else
  echo "[dev] не смог нажать Emulator автоматически — нажми кнопку в окне симулятора"
fi

echo -n "[dev] жду устройство :7833"
up=0
for _ in $(seq 1 90); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:7833/ 2>/dev/null)" = "200" ]; then up=1; break; fi
  echo -n "."; sleep 1
done
echo
[ "$up" = "1" ] || { echo "[dev] устройство не поднялось, смотри $LOG"; exit 1; }

# --- 5. Choose app (auto-listed from apps/<platform>/) ----------------------
if [ -z "$APP_ARG" ]; then
  APPS=()
  while IFS= read -r d; do APPS+=("$(basename "$d")"); done \
    < <(find "$ROOT/apps/$FOLDER" -mindepth 1 -maxdepth 1 -type d | sort)
  [ "${#APPS[@]}" -gt 0 ] || { echo "[dev] нет приложений в apps/$FOLDER"; exit 1; }
  echo
  echo "Выбери приложение ($FOLDER):"
  select APP_ARG in "${APPS[@]}"; do
    case "${APP_ARG:-}" in
      "") echo "неверный выбор" ;;
      *) break ;;
    esac
  done
fi

[ -d "$ROOT/apps/$FOLDER/$APP_ARG" ] || {
  echo "[dev] нет приложения apps/$FOLDER/$APP_ARG"; exit 1; }

# --- 6. Deploy and verify side-service --------------------------------------
SIM_LOG="${ZEPP_SIM_DIR:-/opt/simulator}/sim-debug.log"
before=0
[ -f "$SIM_LOG" ] && before=$(wc -l < "$SIM_LOG")
DEPLOY_LOG="${TMPDIR:-/tmp}/zepp-deploy.log"

"$ROOT/scripts/deploy.sh" "$FOLDER/$APP_ARG" dev >"$DEPLOY_LOG" 2>&1 &
DPID=$!
echo "[dev] деплою $FOLDER/$APP_ARG на $MODEL (pid $DPID)"

HOOK_APP=0
grep -q '"app-side"' "$ROOT/apps/$FOLDER/$APP_ARG/app.json" 2>/dev/null && HOOK_APP=1
if [ "$HOOK_APP" = "1" ]; then
  up=0
  for _ in $(seq 1 75); do
    if [ -f "$SIM_LOG" ] && tail -n +$((before + 1)) "$SIM_LOG" 2>/dev/null | grep -q "shake success"; then
      up=1; break
    fi
    kill -0 "$DPID" 2>/dev/null || true
    sleep 2
  done
  if [ "$up" = "1" ]; then
    echo "[dev] side-service поднялся — сеть в приложении работает"
  else
    echo "[dev] ВНИМАНИЕ: не увидел 'shake success' за 150с (лог: $DEPLOY_LOG)"
  fi
else
  echo "[dev] у приложения нет app-side — жду установку"
  sleep 15
fi

if [ "$WATCH" = "1" ]; then
  wait "$DPID"
else
  kill "$DPID" 2>/dev/null || true
  echo "[dev] установлено"
fi
