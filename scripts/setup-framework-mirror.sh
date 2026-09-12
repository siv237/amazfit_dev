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
#   ZEPP_FW_MIRROR   local mirror directory   (default: /tmp/zepp-fw)
#   ZEPP_FW_PORT     local HTTP port          (default: 8099)

set -euo pipefail

PROXY="${ZEPP_PROXY:-http://127.0.0.1:17277}"
FW_VERSION="${ZEPP_FW_VERSION:-v4.0.0.4}"
DIR="${ZEPP_FW_MIRROR:-/tmp/zepp-fw}"
PORT="${ZEPP_FW_PORT:-8099}"

mkdir -p "$DIR/$FW_VERSION"

for f in side-service.html mobile-main-service.js; do
  url="https://zepp-os.zepp.com/frameworks/$FW_VERSION/$f"
  echo "[mirror] fetching $f"
  curl -sL --http1.1 ${PROXY:+-x "$PROXY"} --max-time 180 -o "$DIR/$FW_VERSION/$f" "$url"
  test -s "$DIR/$FW_VERSION/$f" || { echo "[mirror] empty: $f"; exit 1; }
done

size=$(wc -c < "$DIR/$FW_VERSION/mobile-main-service.js")
echo "[mirror] mobile-main-service.js = $size bytes (expect ~448862)"

cat > "$HOME/.zepp/.simulator.config.js" <<EOF
module.exports = {
  simulator: {
    "side-service": {
      url: "http://127.0.0.1:$PORT/$FW_VERSION/side-service.html",
    },
  },
};
EOF
echo "[mirror] wrote ~/.zepp/.simulator.config.js -> http://127.0.0.1:$PORT/$FW_VERSION/side-service.html"

if [ "${1:-}" = "--serve" ]; then
  echo "[mirror] serving $DIR on 127.0.0.1:$PORT"
  exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR"
fi
