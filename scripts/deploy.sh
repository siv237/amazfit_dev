#!/usr/bin/env bash
#
# Sync a Zepp OS app from ./apps/<app> to the build workspace and run zeus.
#
# Usage:
#   scripts/deploy.sh <app> [build|dev|preview|clean]
#
# Env:
#   ZEPP_WORKDIR  build workspace (default: ~/zepp-dev)
#
# Source of truth is ./apps/<app>. node_modules and dist are not synced;
# node_modules is installed on demand in the workspace.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="$ROOT/apps"
WORK_DIR="${ZEPP_WORKDIR:-$HOME/zepp-dev}"

APP="${1:-}"
CMD="${2:-build}"

usage() {
  echo "usage: $0 <app> [build|dev|preview|clean]"
  [ -d "$APPS_DIR" ] && { echo "apps:"; ls -1 "$APPS_DIR"; }
  exit 1
}

[ -n "$APP" ] || usage
[ -d "$APPS_DIR/$APP" ] || { echo "no such app: $APP"; usage; }

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || true
fi
hash -r

DEST="$WORK_DIR/$APP"

if [ "$CMD" = "clean" ]; then
  echo "[deploy] removing $DEST"
  rm -rf "$DEST"
  exit 0
fi

mkdir -p "$WORK_DIR"
echo "[deploy] sync $APP -> $DEST"
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  "$APPS_DIR/$APP/" "$DEST/"

if [ ! -d "$DEST/node_modules" ]; then
  echo "[deploy] installing dependencies"
  ( cd "$DEST" && npm install )
fi

case "$CMD" in
  build)   ( cd "$DEST" && exec zeus build ) ;;
  dev)     ( cd "$DEST" && exec zeus dev ) ;;
  preview) ( cd "$DEST" && exec zeus preview ) ;;
  *) usage ;;
esac
