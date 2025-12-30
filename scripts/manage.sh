#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CMD="${1:-}"
DEV_PORT="${DEV_PORT:-1210}"
PROD_PORT="${PROD_PORT:-1212}"
NEXT_BIN="$ROOT_DIR/node_modules/.bin/next"
PID_FILE="${PID_FILE:-/tmp/ethnos-next.pid}"
LOG_FILE="${LOG_FILE:-/tmp/ethnos-next.log}"
DAEMON_READY_TIMEOUT="${DAEMON_READY_TIMEOUT:-10}"
SYSTEMD_ARGS="${SYSTEMD_ARGS:-}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-}"

port_listening() {
  local TARGET="$1"
  if ss -lptn "sport = :$TARGET" 2>/dev/null | tail -n +2 | grep -q .; then
    return 0
  fi
  if lsof -i TCP:"$TARGET" -s TCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

load_env() {
  if [ -f /etc/next-frontend.env ]; then
    . /etc/next-frontend.env
  fi
}

systemd_restart() {
  if [ -z "$SYSTEMD_SERVICE" ]; then
    return 1
  fi
  if ! command -v systemctl >/dev/null 2>&1; then
    return 1
  fi
  systemctl $SYSTEMD_ARGS restart "$SYSTEMD_SERVICE"
  systemctl $SYSTEMD_ARGS is-active --quiet "$SYSTEMD_SERVICE"
}

ensure_node() {
  if command -v node >/dev/null 2>&1 && node -v | grep -qE '^v(20|21|22|23|24)\.'; then
    return 0
  fi
  if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
  elif [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
  fi
  if command -v nvm >/dev/null 2>&1; then
    nvm use --silent 24 >/dev/null 2>&1 || nvm install 24 >/dev/null 2>&1 || true
    if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v(20|21|22|23|24)\.'; then
      nvm use --silent 20 >/dev/null 2>&1 || nvm install 20 >/dev/null 2>&1 || true
    fi
  fi
  if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v(20|21|22|23|24)\.'; then
    echo "Node >=20 <25 is required. Install Node 24 LTS if possible." >&2
    exit 1
  fi
}

css() {
  node "$ROOT_DIR/scripts/build-css.mjs"
}

dev() {
  ensure_node
  load_env
  export PORT="${PORT:-$DEV_PORT}"
  css
  exec npx next dev -p "$PORT"
}

build() {
  ensure_node
  load_env
  export NODE_ENV=production
  css
  npx next build
}

start() {
  ensure_node
  load_env
  export NODE_ENV=production
  export PORT="${PORT:-$PROD_PORT}"
  if [ -f "$PID_FILE" ]; then
    local PID
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      echo "Daemon already running on PID $PID" >&2
      exit 0
    fi
    rm -f "$PID_FILE"
  fi
  if port_listening "$PORT"; then
    echo "Port $PORT already in use. Run scripts/manage.sh stop first." >&2
    exit 1
  fi
  if [ ! -x "$NEXT_BIN" ]; then
    echo "Missing Next binary at $NEXT_BIN. Run npm install." >&2
    exit 1
  fi
  echo "Starting daemon on port $PORT (log: $LOG_FILE)"
  nohup "$NEXT_BIN" start -p "$PORT" >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  local waited=0
  while [ "$waited" -lt "$DAEMON_READY_TIMEOUT" ]; do
    if port_listening "$PORT"; then
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done
  local NEW_PID
  NEW_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -z "$NEW_PID" ] || ! kill -0 "$NEW_PID" 2>/dev/null; then
    echo "Daemon failed to start. Check $LOG_FILE" >&2
    rm -f "$PID_FILE"
    exit 1
  fi
  if ! port_listening "$PORT"; then
    echo "Daemon running on PID $NEW_PID but port $PORT is still warming up."
  fi
}

stop() {
  local PID
  if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      echo "Stopping daemon on PID $PID"
      kill "$PID" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  local NEXT_PIDS
  NEXT_PIDS="$(pgrep -f 'next-server' || true)"
  if [ -n "$NEXT_PIDS" ]; then
    echo "Stopping lingering next-server processes: $NEXT_PIDS"
    kill $NEXT_PIDS 2>/dev/null || true
  fi
  local P="${PORT:-$PROD_PORT}"
  local PIDS
  PIDS="$(lsof -t -i TCP:$P -s TCP:LISTEN 2>/dev/null || true)"
  if [ -z "${PIDS:-}" ]; then
    PIDS="$(ss -lptn "sport = :$P" 2>/dev/null | awk -F 'pid=' 'NR>1{split($2,a,","); print a[1]}' | tr -d ' ' || true)"
  fi
  if [ -n "${PIDS:-}" ]; then
    echo "Stopping processes bound to port $P: $PIDS"
    kill $PIDS 2>/dev/null || true
  fi
}

restart() {
  if systemd_restart; then
    return 0
  fi
  stop
  start
}

clean() {
  rm -rf "$ROOT_DIR/.next" "$ROOT_DIR/.turbo" "$ROOT_DIR/node_modules/.cache" 2>/dev/null || true
}

cache_clean() {
  rm -rf "$ROOT_DIR/.next/cache" "$ROOT_DIR/.turbo" "$ROOT_DIR/node_modules/.cache" 2>/dev/null || true
}

check() {
  ensure_node
  node -v
  npm -v
  npx next --version || true
  if [ ! -f "$ROOT_DIR/public/css/styles.css" ]; then
    echo "Missing public/css/styles.css" >&2
    exit 1
  fi
}

deps() {
  ensure_node
  if [ -f "$ROOT_DIR/package-lock.json" ]; then
    NODE_ENV=development npm ci --no-fund --audit=false
  else
    NODE_ENV=development npm install --no-fund --audit=false
  fi
}

deploy() {
  ensure_node
  load_env
  clean
  deps
  export NODE_ENV=production
  css
  npx next build
  restart
}

usage() {
  echo "Usage: $0 {css|dev|build|start|stop|restart|clean|cache_clean|check|deps|deploy}"
}

case "$CMD" in
  css|dev|build|start|stop|restart|clean|cache_clean|check|deps|deploy)
    "$CMD"
    ;;
  *)
    usage
    exit 1
    ;;
esac
