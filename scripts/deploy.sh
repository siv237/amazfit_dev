#!/usr/bin/env bash
#
# Sync a Zepp OS app from ./apps/<model>/<app> to the build workspace and run zeus.
#
# Usage:
#   scripts/deploy.sh <model>/<app> [build|dev|preview|clean]
#   scripts/deploy.sh <app>         [build|dev|preview|clean]   # if unique
#
# Env:
#   ZEPP_WORKDIR  build workspace (default: ~/zepp-dev)
#
# Source of truth is ./apps/<model>/<app>. node_modules and dist are not synced;
# node_modules is installed on demand in the workspace.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="$ROOT/apps"
WORK_DIR="${ZEPP_WORKDIR:-$HOME/zepp-dev}"

APP="${1:-}"
CMD="${2:-build}"

usage() {
  echo "usage: $0 <model>/<app> [build|dev|preview|clean]"
  [ -d "$APPS_DIR" ] && { echo "apps:"; find "$APPS_DIR" -mindepth 2 -maxdepth 2 -type d | sed "s#$APPS_DIR/##" | sort; }
  exit 1
}

[ -n "$APP" ] || usage

SRC="$APPS_DIR/$APP"
if [ ! -d "$SRC" ]; then
  matches=()
  while IFS= read -r m; do matches+=("$m"); done < <(find "$APPS_DIR" -mindepth 2 -maxdepth 2 -type d -name "$APP")
  if [ "${#matches[@]}" -eq 1 ]; then
    SRC="${matches[0]}"
    echo "[deploy] resolved $APP -> ${SRC#"$APPS_DIR/"}"
  else
    echo "no such app or ambiguous: $APP"
    usage
  fi
fi
NAME="$(basename "$SRC")"

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || true
fi
hash -r

DEST="$WORK_DIR/$NAME"

if [ "$CMD" = "clean" ]; then
  echo "[deploy] removing $DEST"
  rm -rf "$DEST"
  exit 0
fi

mkdir -p "$WORK_DIR"
echo "[deploy] sync ${SRC#"$APPS_DIR/"} -> $DEST"
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  "$SRC/" "$DEST/"

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
