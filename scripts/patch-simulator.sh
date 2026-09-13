#!/usr/bin/env bash
#
# Apply the required patches to the Zepp OS simulator (idempotent, portable).
#
# 1. QEMU network. The firmware hardcodes its guest IP (GTS 4: 192.168.166.188,
#    Bip 6: 10.0.2.15), while stock start_qemu.sh uses `hostfwd=tcp::7833-:7833`.
#    Without the matching usernet subnet port 7833 is unreachable.
#    Marker: ZEPP_AUTONET.
#
# 2. Keep side-service binding alive. Stock side-service.js tears down the
#    side-service RPC binding when the detached DevTools window closes, after
#    which the device never answers "shake" and apps lose network
#    ("C:shake timeout"). We neuter those two statements byte-for-byte inside
#    app.asar (same length, so no asar rebuild needed).
#
# Usage:
#   scripts/patch-simulator.sh
#
# Env:
#   ZEPP_SIM_DIR  simulator install dir (default: /opt/simulator)

set -euo pipefail

SIM_DIR="${ZEPP_SIM_DIR:-/opt/simulator}"
QW="$SIM_DIR/resources/firmware/start_qemu.sh"
ASAR="$SIM_DIR/resources/app.asar"

# --- 1. QEMU network patch ---------------------------------------------------
if [ ! -f "$QW" ]; then
  echo "[patch] not found: $QW" >&2; exit 1
fi

if grep -q "ZEPP_AUTONET" "$QW"; then
  echo "[patch] start_qemu.sh already patched"
else
  SUDO=""; [ -w "$QW" ] || SUDO="sudo"
  $SUDO python3 - "$QW" <<'PY'
import re, sys
path = sys.argv[1]
src = open(path, encoding="utf-8").read()
block = '''    # ZEPP_AUTONET: firmware hardcodes its guest IP (GTS4 192.168.166.188,
    # Bip6 10.0.2.15). Pick the usernet subnet that matches the firmware.
    if grep -aq "192.168.166.188" "$firmware"; then
        opt_network="-nic user,id=usernet,net=192.168.166.0/24,host=192.168.166.1,hostfwd=tcp::7833-192.168.166.188:7833,model=lan9118"
    else
        opt_network="-nic user,id=usernet,net=10.0.2.0/24,host=10.0.2.2,hostfwd=tcp::7833-10.0.2.15:7833,model=lan9118"
    fi'''
new, n = re.subn(r'^[ \t]*opt_network="-nic user[^\n]*', block, src, count=1, flags=re.M)
if n == 0:
    print("[patch] opt_network line not found; simulator version changed?", file=sys.stderr)
    sys.exit(1)
open(path, "w", encoding="utf-8").write(new)
print("[patch] applied ZEPP_AUTONET to start_qemu.sh")
PY
fi

# --- 2. Keep side-service binding on DevTools close --------------------------
if [ ! -f "$ASAR" ]; then
  echo "[patch] not found: $ASAR" >&2; exit 1
fi

SUDO=""; [ -w "$ASAR" ] || SUDO="sudo"
$SUDO python3 - "$ASAR" <<'PY'
import sys
path = sys.argv[1]
A = b"destroySideServiceBinding(exports.sideWindow, 'close side window');"
B = b"exports.sideWindow = null;"
data = open(path, "rb").read()
ia = data.find(A)
if ia == -1:
    if b"side window not existed" in data:
        print("[patch] app.asar already patched")
        sys.exit(0)
    print("[patch] side-service pattern not found", file=sys.stderr)
    sys.exit(1)
ib = data.find(B, ia)
if ib == -1:
    print("[patch] sideWindow=null pattern not found", file=sys.stderr)
    sys.exit(1)
noop = lambda n: b"void 0;" + b" " * (n - 7)
data = data[:ia] + noop(len(A)) + data[ia + len(A):]
data = data[:ib] + noop(len(B)) + data[ib + len(B):]
open(path, "wb").write(data)
print("[patch] app.asar byte-patched (binding survives DevTools close)")
PY
