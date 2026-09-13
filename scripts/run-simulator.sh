#!/usr/bin/env bash
#
# Start the Zepp OS simulator correctly.
#
# Why this script exists: the simulator MUST run with /opt/simulator as its
# working directory. When launched from any other cwd the QEMU device never
# completes the side-service handshake - the device log shows only
# "shake send" (no "shake success"), and apps fail with "C:shake timeout"
# even though port 7833 is up. Running from /opt/simulator makes the device
# answer "shake success appSidePort=> 1001" and network works.
#
# It also makes sure the local side-service runtime mirror is up, because
# zepp-os.zepp.com downloads are truncated in this network.
#
# Usage:
#   scripts/run-simulator.sh
#
# Env:
#   ZEPP_SIM_DIR     simulator install dir        (default: /opt/simulator)
#   ZEPP_FW_MIRROR   mirror directory             (default: <repo>/vendor/zepp-fw)
#   ZEPP_FW_PORT     mirror HTTP port             (default: 8099)
#   ZEPP_FW_VERSION  framework version            (default: v4.0.0.4)

set -euo pipefail

SIM_DIR="${ZEPP_SIM_DIR:-/opt/simulator}"
PORT="${ZEPP_FW_PORT:-8099}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIRROR="${ZEPP_FW_MIRROR:-$ROOT/vendor/zepp-fw}"

# 1. Make sure the config points at the project-local mirror.
"$ROOT/scripts/setup-framework-mirror.sh" >/dev/null

# 2. Serve the mirror locally if it is not already up.
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
  echo "[sim] serving $MIRROR on 127.0.0.1:$PORT"
  ( python3 -m http.server "$PORT" --bind 127.0.0.1 \
      --directory "$MIRROR" >/dev/null 2>&1 & )
  sleep 1
fi

# 3. Launch from $SIM_DIR (the whole point of this script).
cd "$SIM_DIR"
echo "[sim] starting simulator from $(pwd)"
exec env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS "$SIM_DIR/simulator"
