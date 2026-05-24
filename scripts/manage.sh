#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CMD="${1:-}"
DEV_PORT="${DEV_PORT:-1210}"
PROD_PORT="${PROD_PORT:-1212}"
NEXT_BIN="$ROOT_DIR/node_modules/.bin/next"
ENV_FILE="${ENV_FILE:-}"
PID_FILE="${PID_FILE:-/tmp/ethnos-next.pid}"
LOG_FILE="${LOG_FILE:-/tmp/ethnos-next.log}"
DAEMON_READY_TIMEOUT="${DAEMON_READY_TIMEOUT:-10}"
SYSTEMD_ARGS="${SYSTEMD_ARGS:---user}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-ethnos-app.service}"
MAINTENANCE_DROPIN_DIR="${MAINTENANCE_DROPIN_DIR:-$HOME/.config/systemd/user/ethnos-app.service.d}"
MAINTENANCE_DROPIN_FILE="${MAINTENANCE_DROPIN_FILE:-$MAINTENANCE_DROPIN_DIR/maintenance.conf}"

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

load_env_file() {
  local FILE_PATH="$1"
  if [ ! -f "$FILE_PATH" ]; then
    return 1
  fi
  set -a
  . "$FILE_PATH"
  set +a
  return 0
}

load_env() {
  if [ -n "$ENV_FILE" ]; then
    if ! load_env_file "$ENV_FILE"; then
      echo "Environment file not found: $ENV_FILE" >&2
      exit 1
    fi
    return
  fi
  load_env_file /etc/next-frontend.env && return
  load_env_file "$ROOT_DIR/config/env/next-frontend.env" && return
  load_env_file "$ROOT_DIR/.env.local" && return
  load_env_file "$ROOT_DIR/.env" && return
  return 0
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
  export PORT="$PROD_PORT"
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

start_foreground() {
  ensure_node
  load_env
  export NODE_ENV=production
  export PORT="$PROD_PORT"
  if [ ! -x "$NEXT_BIN" ]; then
    echo "Missing Next binary at $NEXT_BIN. Run npm install." >&2
    exit 1
  fi
  exec "$NEXT_BIN" start -p "$PORT"
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
  local P="$PROD_PORT"
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

  local DEST="$HOME/.config/systemd/user/ethnos-app.service"
  if [ ! -f "$DEST" ]; then
    setup_service
  fi
  systemctl --user restart "$SYSTEMD_SERVICE"
  systemctl --user is-active --quiet "$SYSTEMD_SERVICE"
}

setup_service() {
  local SRC="$ROOT_DIR/scripts/systemd/ethnos-app.service"
  local DEST_DIR="$HOME/.config/systemd/user"
  local DEST="$DEST_DIR/ethnos-app.service"

  if [ ! -f "$SRC" ]; then
    echo "Service unit not found at $SRC" >&2
    exit 1
  fi

  mkdir -p "$DEST_DIR"
  cp "$SRC" "$DEST"
  echo "Installed service to $DEST"

  systemctl --user daemon-reload
  systemctl --user enable ethnos-app.service
  echo "Service enabled."

  if command -v loginctl >/dev/null 2>&1; then
    if ! loginctl show-user "$USER" --property=Linger 2>/dev/null | grep -q "Linger=yes"; then
      echo "Enabling linger for $USER (may require sudo)..."
      loginctl enable-linger "$USER" 2>/dev/null || sudo loginctl enable-linger "$USER" || echo "Warning: could not enable linger. Service will stop on logout." >&2
    fi
  fi

  echo "Setup complete. Use 'scripts/manage.sh deploy' to build and start, or 'systemctl --user start ethnos-next' to start directly."
}

uninstall() {
  local DEST="$HOME/.config/systemd/user/ethnos-app.service"

  echo "Uninstalling Ethnos..."

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl --user is-active --quiet "$SYSTEMD_SERVICE" 2>/dev/null; then
      echo "Stopping service..."
      systemctl --user stop "$SYSTEMD_SERVICE"
    fi
    if systemctl --user is-enabled --quiet "$SYSTEMD_SERVICE" 2>/dev/null; then
      echo "Disabling service..."
      systemctl --user disable "$SYSTEMD_SERVICE"
    fi
    if [ -f "$DEST" ]; then
      echo "Removing service unit..."
      rm -f "$DEST"
      systemctl --user daemon-reload
      systemctl --user reset-failed 2>/dev/null || true
    fi
  fi

  stop

  echo "Removing build artifacts..."
  rm -rf "$ROOT_DIR/.next" "$ROOT_DIR/.turbo" 2>/dev/null || true

  echo "Removing node_modules..."
  rm -rf "$ROOT_DIR/node_modules" 2>/dev/null || true

  rm -f "$PID_FILE" "$LOG_FILE" 2>/dev/null || true

  echo "Uninstall complete. Source code preserved in $ROOT_DIR."
}

maintenance_is_active() {
  [ -f "$MAINTENANCE_DROPIN_FILE" ]
}

maintenance_on() {
  mkdir -p "$MAINTENANCE_DROPIN_DIR"
  cat >"$MAINTENANCE_DROPIN_FILE" <<'UNIT'
[Service]
Environment=MAINTENANCE_MODE=1
UNIT
  echo "Wrote $MAINTENANCE_DROPIN_FILE"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl $SYSTEMD_ARGS daemon-reload
    if systemctl $SYSTEMD_ARGS is-active --quiet "$SYSTEMD_SERVICE" 2>/dev/null; then
      systemctl $SYSTEMD_ARGS restart "$SYSTEMD_SERVICE"
      echo "Restarted $SYSTEMD_SERVICE with MAINTENANCE_MODE=1"
    else
      echo "Service is not active. Start it with 'systemctl $SYSTEMD_ARGS start $SYSTEMD_SERVICE' to enter maintenance."
    fi
  else
    echo "systemctl not available. Set MAINTENANCE_MODE=1 in the runtime env and restart the service manually."
  fi
}

maintenance_off() {
  if [ -f "$MAINTENANCE_DROPIN_FILE" ]; then
    rm -f "$MAINTENANCE_DROPIN_FILE"
    rmdir "$MAINTENANCE_DROPIN_DIR" 2>/dev/null || true
    echo "Removed $MAINTENANCE_DROPIN_FILE"
  else
    echo "Maintenance flag was not set."
  fi
  if command -v systemctl >/dev/null 2>&1; then
    systemctl $SYSTEMD_ARGS daemon-reload
    if systemctl $SYSTEMD_ARGS is-active --quiet "$SYSTEMD_SERVICE" 2>/dev/null; then
      systemctl $SYSTEMD_ARGS restart "$SYSTEMD_SERVICE"
      echo "Restarted $SYSTEMD_SERVICE"
    fi
  fi
}

maintenance_status() {
  if maintenance_is_active; then
    echo "maintenance: ON ($MAINTENANCE_DROPIN_FILE)"
  else
    echo "maintenance: OFF"
  fi
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl $SYSTEMD_ARGS is-active --quiet "$SYSTEMD_SERVICE" 2>/dev/null; then
      echo "service: active"
    else
      echo "service: inactive"
    fi
  fi
}

maintenance() {
  local SUB="${2:-status}"
  case "$SUB" in
    on|enable|start) maintenance_on ;;
    off|disable|stop) maintenance_off ;;
    status|"") maintenance_status ;;
    *)
      echo "Usage: $0 maintenance {on|off|status}" >&2
      exit 1
      ;;
  esac
}

usage() {
  echo "Usage: $0 {css|dev|build|start|start_foreground|stop|restart|clean|cache_clean|check|deps|deploy|setup_service|uninstall|maintenance [on|off|status]}"
}

case "$CMD" in
  css|dev|build|start|start_foreground|stop|restart|clean|cache_clean|check|deps|deploy|setup_service|uninstall)
    "$CMD"
    ;;
  maintenance)
    maintenance "$@"
    ;;
  *)
    usage
    exit 1
    ;;
esac
