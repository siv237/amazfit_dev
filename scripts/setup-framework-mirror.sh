#!/usr/bin/env bash
#
# Mirror the Zepp OS side-service runtime locally and point the simulator at it.
#
# Why: zepp-os.zepp.com downloads are truncated in this network (~16 KB instead
# of ~448 KB), which leaves the side-service runtime incomplete. As a result
# app-side calls fail with "shake timeout". Serving a full local copy fixes it.
#
# Usage:
#   scripts/setup-framework-mirror.sh
#   scripts/setup-framework-mirror.sh --serve      # also start the static server
#
# Env:
#   ZEPP_PROXY       HTTP proxy for the download (default: http://127.0.0.1:17277)
#   ZEPP_FW_VERSION  framework version        (default: v4.0.0.4)
#   ZEPP_FW_MIRROR   mirror directory        (default: <repo>/vendor/zepp-fw)
#   ZEPP_FW_PORT     local HTTP port          (default: 8099)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROXY="${ZEPP_PROXY:-http://127.0.0.1:17277}"
FW_VERSION="${ZEPP_FW_VERSION:-v4.0.0.4}"
DIR="${ZEPP_FW_MIRROR:-$ROOT/vendor/zepp-fw}"
PORT="${ZEPP_FW_PORT:-8099}"

mkdir -p "$DIR/$FW_VERSION"

# Keep an existing full copy (e.g. committed in vendor/) unless it is missing
# or truncated. Set ZEPP_FW_FORCE=1 to re-download.
have_full=0
if [ -s "$DIR/$FW_VERSION/mobile-main-service.js" ] &&
   [ "$(wc -c < "$DIR/$FW_VERSION/mobile-main-service.js")" -gt 300000 ]; then
  have_full=1
fi

if [ "$have_full" = "0" ] || [ "${ZEPP_FW_FORCE:-0}" = "1" ]; then
  for f in side-service.html mobile-main-service.js; do
    url="https://zepp-os.zepp.com/frameworks/$FW_VERSION/$f"
    echo "[mirror] fetching $f"
    curl -sL --http1.1 ${PROXY:+-x "$PROXY"} --max-time 180 -o "$DIR/$FW_VERSION/$f" "$url"
    test -s "$DIR/$FW_VERSION/$f" || { echo "[mirror] empty: $f"; exit 1; }
  done
else
  echo "[mirror] using existing $DIR/$FW_VERSION"
fi

size=$(wc -c < "$DIR/$FW_VERSION/mobile-main-service.js")
echo "[mirror] mobile-main-service.js = $size bytes (expect ~448862)"

# Mirror the phone-side Settings App runtime (used by the simulator's Settings
# window). It is also truncated on the direct path.
AS_DIR="$DIR/app-settings/v1.0.1"
AS_VERSION="v1.0.1"
mkdir -p "$AS_DIR"
if [ ! -s "$AS_DIR/index.html" ] || [ "${ZEPP_FW_FORCE:-0}" = "1" ]; then
  echo "[mirror] fetching app-settings/$AS_VERSION/index.html"
  curl -sL --http1.1 ${PROXY:+-x "$PROXY"} --max-time 120 \
    -o "$AS_DIR/index.html" "https://zepp-os.zepp.com/app-settings/$AS_VERSION/index.html"
fi
as_js=$(grep -oE 'app-settings[^"]+\.prod\.js' "$AS_DIR/index.html" | head -1)
if [ -n "$as_js" ] && { [ ! -s "$AS_DIR/$as_js" ] || [ "${ZEPP_FW_FORCE:-0}" = "1" ]; }; then
  echo "[mirror] fetching app-settings/$AS_VERSION/$as_js"
  curl -sL --http1.1 ${PROXY:+-x "$PROXY"} --max-time 180 \
    -o "$AS_DIR/$as_js" "https://zepp-os.zepp.com/app-settings/$AS_VERSION/$as_js"
fi

cat > "$HOME/.zepp/.simulator.config.js" <<EOF
module.exports = {
  simulator: {
    "side-service": {
      url: "http://127.0.0.1:$PORT/$FW_VERSION/side-service.html",
    },
    "setting-service": {
      url: "http://127.0.0.1:$PORT/app-settings/$AS_VERSION/index.html",
    },
  },
};
EOF
echo "[mirror] wrote ~/.zepp/.simulator.config.js -> side-service + setting-service"

if [ "${1:-}" = "--serve" ]; then
  echo "[mirror] serving $DIR on 127.0.0.1:$PORT"
  exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR"
fi
