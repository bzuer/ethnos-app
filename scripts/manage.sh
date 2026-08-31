#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CMD="${1:-}"
NEXT_BIN="$ROOT_DIR/node_modules/.bin/next"
ENV_FILE="${ENV_FILE:-}"
PID_FILE="${PID_FILE:-/tmp/ethnos-next.pid}"
LOG_FILE="${LOG_FILE:-/tmp/ethnos-next.log}"
DAEMON_READY_TIMEOUT="${DAEMON_READY_TIMEOUT:-10}"
SYSTEMD_ARGS="${SYSTEMD_ARGS:---user}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-ethnos-app.service}"
MAINTENANCE_DROPIN_DIR="${MAINTENANCE_DROPIN_DIR:-$HOME/.config/systemd/user/ethnos-app.service.d}"
MAINTENANCE_DROPIN_FILE="${MAINTENANCE_DROPIN_FILE:-$MAINTENANCE_DROPIN_DIR/maintenance.conf}"
NGINX_RENDER="$ROOT_DIR/scripts/nginx/render-config.sh"
NODE_MIN_MAJOR="${NODE_MIN_MAJOR:-20}"
NODE_MAX_MAJOR="${NODE_MAX_MAJOR:-24}"

# nginx owns every port a client reaches; the Next server only ever binds
# loopback. Values set on the command line win over the ones in the env file,
# which load_env would otherwise overwrite, so they are captured before it runs.
APP_PORT_OVERRIDE="${APP_PORT:-${PROD_PORT:-}}"
APP_BIND_HOST_OVERRIDE="${APP_BIND_HOST:-}"
PUBLIC_PORT_OVERRIDE="${PUBLIC_PORT:-}"
DEV_PORT_OVERRIDE="${DEV_PORT:-}"
DEV_HOST_OVERRIDE="${DEV_HOST:-}"
NGINX_APP_CONF_OVERRIDE="${NGINX_APP_CONF:-}"

# APP_BIND_HOST is what Next binds; it must stay `localhost`. Next builds the
# origin it compares middleware rewrites against from this value, so `-H
# 127.0.0.1` makes every rewrite (i.e. every default-locale URL) look external:
# `/` answers 307 to itself, and with X-Forwarded-Proto: https it 500s trying to
# speak TLS to its own plaintext port. `localhost` resolves to loopback all the
# same, which `verify` asserts. APP_UPSTREAM_HOST is the address nginx dials.
resolve_ports() {
  APP_PORT="${APP_PORT_OVERRIDE:-${APP_PORT:-1202}}"
  APP_BIND_HOST="${APP_BIND_HOST_OVERRIDE:-${APP_BIND_HOST:-localhost}}"
  APP_UPSTREAM_HOST="${APP_UPSTREAM_HOST:-127.0.0.1}"
  PUBLIC_PORT="${PUBLIC_PORT_OVERRIDE:-${NGINX_PUBLIC_PORT:-1212}}"
  DEV_PORT="${DEV_PORT_OVERRIDE:-${DEV_PORT:-1210}}"
  DEV_HOST="${DEV_HOST_OVERRIDE:-${DEV_HOST:-localhost}}"
  NGINX_APP_CONF="${NGINX_APP_CONF_OVERRIDE:-${NGINX_APP_CONF:-/etc/nginx/conf.d/ethnos-app.conf}}"
  NGINX_LISTEN="${NGINX_LISTEN_ADDRESS-127.0.0.1}"
}
resolve_ports

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

# A listener on anything but 127.0.0.0/8 or [::1] is reachable from the network,
# which is exactly what nginx is here to prevent.
port_loopback_only() {
  local TARGET="$1" ADDRESSES
  ADDRESSES="$(ss -lntH "sport = :$TARGET" 2>/dev/null | awk '{print $4}')"
  [ -n "$ADDRESSES" ] || return 1
  ! printf '%s\n' "$ADDRESSES" | grep -qvE '^(127\.[0-9.]+|\[::1\])'
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

node_major() {
  local VERSION
  VERSION="$(node -v 2>/dev/null || true)"
  VERSION="${VERSION#v}"
  printf '%s' "${VERSION%%.*}"
}

node_supported() {
  local MAJOR="${1:-}"
  case "$MAJOR" in ''|*[!0-9]*) return 1 ;; esac
  [ "$MAJOR" -ge "$NODE_MIN_MAJOR" ] && [ "$MAJOR" -le "$NODE_MAX_MAJOR" ]
}

# The highest nvm-installed version inside the supported range, preferring the
# major in .nvmrc. Returns the bin directory, which the caller PREPENDS to PATH:
# `nvm use` only rewrites the nvm entry already in PATH, so with a Homebrew node
# ahead of it (as on this host) the switch silently has no effect.
nvm_node_bin() {
  local ROOT="${NVM_DIR:-$HOME/.nvm}/versions/node"
  [ -d "$ROOT" ] || return 1
  local WANTED="" DIR MAJOR BEST="" BEST_WANTED=""
  if [ -f "$ROOT_DIR/.nvmrc" ]; then
    WANTED="$(tr -d ' \t\r\nv' < "$ROOT_DIR/.nvmrc")"
    WANTED="${WANTED%%.*}"
  fi
  for DIR in $(ls -1 "$ROOT" 2>/dev/null | sort -V); do
    [ -x "$ROOT/$DIR/bin/node" ] || continue
    MAJOR="${DIR#v}"
    MAJOR="${MAJOR%%.*}"
    node_supported "$MAJOR" || continue
    BEST="$ROOT/$DIR/bin"
    [ -n "$WANTED" ] && [ "$MAJOR" = "$WANTED" ] && BEST_WANTED="$ROOT/$DIR/bin"
  done
  BEST="${BEST_WANTED:-$BEST}"
  [ -n "$BEST" ] || return 1
  printf '%s' "$BEST"
}

ensure_node() {
  local BIN_DIR
  if [ -n "${NODE_BIN:-}" ]; then
    BIN_DIR="$NODE_BIN"
    [ -d "$BIN_DIR" ] || BIN_DIR="$(dirname "$BIN_DIR")"
    PATH="$BIN_DIR:$PATH"
    export PATH
  fi
  node_supported "$(node_major)" && return 0

  if BIN_DIR="$(nvm_node_bin)"; then
    PATH="$BIN_DIR:$PATH"
    export PATH
    node_supported "$(node_major)" && return 0
  fi

  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 || true
    if command -v nvm >/dev/null 2>&1; then
      nvm install "$NODE_MAX_MAJOR" >/dev/null 2>&1 || true
      if BIN_DIR="$(nvm_node_bin)"; then
        PATH="$BIN_DIR:$PATH"
        export PATH
        node_supported "$(node_major)" && return 0
      fi
    fi
  fi

  local FOUND
  FOUND="$(node -v 2>/dev/null || echo 'none')"
  echo "Node >=$NODE_MIN_MAJOR <$((NODE_MAX_MAJOR + 1)) is required (package.json#engines); found $FOUND." >&2
  echo "Install it with 'nvm install $NODE_MAX_MAJOR', or point NODE_BIN at a supported node binary." >&2
  exit 1
}

css() {
  node "$ROOT_DIR/scripts/build-css.mjs"
}

dev() {
  ensure_node
  load_env
  resolve_ports
  export PORT="${PORT:-$DEV_PORT}"
  css
  exec npx next dev -H "$DEV_HOST" -p "$PORT"
}

build() {
  ensure_node
  load_env
  resolve_ports
  export NODE_ENV=production
  css
  npx next build
}

start() {
  ensure_node
  load_env
  resolve_ports
  export NODE_ENV=production
  export PORT="$APP_PORT"
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
  echo "Starting daemon on $APP_BIND_HOST:$PORT (log: $LOG_FILE)"
  nohup "$NEXT_BIN" start -H "$APP_BIND_HOST" -p "$PORT" >>"$LOG_FILE" 2>&1 &
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
  nginx_warn_if_absent
}

start_foreground() {
  ensure_node
  load_env
  resolve_ports
  export NODE_ENV=production
  export PORT="$APP_PORT"
  if [ ! -x "$NEXT_BIN" ]; then
    echo "Missing Next binary at $NEXT_BIN. Run npm install." >&2
    exit 1
  fi
  exec "$NEXT_BIN" start -H "$APP_BIND_HOST" -p "$PORT"
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
  resolve_ports
  local P="$APP_PORT"
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

# sudo drops the environment, so the resolved topology is handed over
# explicitly. The renderer still lets /etc/next-frontend.env win, which is what
# keeps the proxy and the service reading one source of truth.
sudo_wrap() {
  local ENVS=("APP_PORT=$APP_PORT" "APP_UPSTREAM_HOST=$APP_UPSTREAM_HOST" "NGINX_PUBLIC_PORT=$PUBLIC_PORT" "NGINX_APP_CONF=$NGINX_APP_CONF")
  # Forwarded only when it is actually set: an empty NGINX_LISTEN_ADDRESS means
  # "every interface", so inventing one here would publish the port.
  [ -n "${NGINX_LISTEN_ADDRESS+x}" ] && ENVS+=("NGINX_LISTEN_ADDRESS=$NGINX_LISTEN_ADDRESS")
  [ -n "$ENV_FILE" ] && ENVS+=("ENV_FILE=$ENV_FILE")
  if [ "$(id -u)" -eq 0 ]; then
    env "${ENVS[@]}" "$@"
    return
  fi
  if ! command -v sudo >/dev/null 2>&1; then
    echo "This step needs root and sudo is not available: run it as root." >&2
    return 1
  fi
  sudo env "${ENVS[@]}" "$@"
}

nginx_installed() {
  [ -f "$NGINX_APP_CONF" ]
}

# The public port is nginx's to own. Starting the app without the vhost leaves
# the site unreachable from the edge, which is worth saying out loud rather than
# discovering through a 502 at the tunnel.
nginx_warn_if_absent() {
  if ! nginx_installed; then
    echo "Warning: $NGINX_APP_CONF is missing — nothing is serving :$PUBLIC_PORT." >&2
    echo "Run 'scripts/manage.sh nginx' to install the front door." >&2
  fi
}

nginx_config() {
  resolve_ports
  if [ "${1:-}" = "--print" ]; then
    exec "$NGINX_RENDER" --print
  fi
  sudo_wrap "$NGINX_RENDER"
}

# Every check the topology depends on, in the order a request travels: the app
# on loopback, nginx on the public port, and a real response through the proxy.
verify_stack() {
  resolve_ports
  local FAILED=0 CODE

  if port_listening "$APP_PORT"; then
    if port_loopback_only "$APP_PORT"; then
      echo "  [OK] app upstream (port $APP_PORT) bound to loopback only"
    else
      echo "  [FAIL] app upstream (port $APP_PORT) is bound beyond loopback" >&2
      FAILED=1
    fi
  else
    echo "  [FAIL] nothing is listening on the app upstream port $APP_PORT" >&2
    FAILED=1
  fi

  if nginx_installed; then
    echo "  [OK] nginx vhost ($NGINX_APP_CONF)"
  else
    echo "  [FAIL] missing nginx vhost ($NGINX_APP_CONF)" >&2
    FAILED=1
  fi

  local PUBLIC_ADDRESSES
  PUBLIC_ADDRESSES="$(ss -lntH "sport = :$PUBLIC_PORT" 2>/dev/null | awk '{print $4}' | tr '\n' ' ')"
  if [ -z "$PUBLIC_ADDRESSES" ]; then
    echo "  [FAIL] nothing is listening on the public port $PUBLIC_PORT" >&2
    FAILED=1
  elif [ -n "$NGINX_LISTEN" ] && printf '%s' "$PUBLIC_ADDRESSES" | grep -qE "(^| )(0\.0\.0\.0|\[::\]):$PUBLIC_PORT( |$)"; then
    # nginx cannot narrow a listen address on reload: it keeps the previous
    # wildcard socket and the config on disk no longer describes what is bound.
    echo "  [FAIL] port $PUBLIC_PORT is bound to ${PUBLIC_ADDRESSES% } but the vhost asks for $NGINX_LISTEN" >&2
    echo "         nginx keeps the old socket across a reload — 'sudo systemctl restart nginx' rebinds it." >&2
    FAILED=1
  else
    echo "  [OK] nginx public (port $PUBLIC_PORT on ${PUBLIC_ADDRESSES% })"
  fi

  # Sent the way the edge sends it: Host is the public name and TLS terminated
  # upstream. A 307 back to "/" here is the APP_BIND_HOST trap, not a redirect.
  local PROBE REDIRECT
  PROBE="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 \
    -H "Host: ${VERIFY_HOST:-ethnos.app}" -H 'X-Forwarded-Proto: https' \
    "http://127.0.0.1:$PUBLIC_PORT/" 2>/dev/null || true)"
  CODE="${PROBE%% *}"
  CODE="${CODE:-000}"
  REDIRECT="${PROBE#* }"
  case "$CODE" in
    200) echo "  [OK] home page through nginx (:$PUBLIC_PORT/ -> HTTP 200)" ;;
    503) echo "  [OK] home page through nginx (:$PUBLIC_PORT/ -> HTTP 503, maintenance mode)" ;;
    3??)
      local RPATH="${REDIRECT#*://}"
      [ "$RPATH" = "$REDIRECT" ] || RPATH="/${RPATH#*/}"
      if [ "$RPATH" = "/" ]; then
        echo "  [FAIL] the home page redirects to itself ($CODE -> ${REDIRECT:-/})." >&2
        echo "         APP_BIND_HOST must be 'localhost': an IP literal makes Next treat every" >&2
        echo "         middleware rewrite as external, so every default-locale URL loops." >&2
        FAILED=1
      else
        echo "  [OK] home page through nginx (:$PUBLIC_PORT/ -> HTTP $CODE -> $REDIRECT)"
      fi
      ;;
    2??) echo "  [OK] home page through nginx (:$PUBLIC_PORT/ -> HTTP $CODE)" ;;
    *) echo "  [FAIL] app not reachable through nginx (:$PUBLIC_PORT/ -> HTTP $CODE)" >&2; FAILED=1 ;;
  esac

  if [ "$FAILED" -ne 0 ]; then
    return 1
  fi
  echo "All checks passed"
}

status() {
  load_env
  resolve_ports
  maintenance_status
  verify_stack
}

deploy() {
  ensure_node
  load_env
  resolve_ports
  # The build takes minutes and the nginx step needs root: asking for the
  # password up front keeps the deploy from stalling on a prompt at the end.
  if [ "${NO_NGINX:-0}" != "1" ] && [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    sudo -v
  fi
  clean
  deps
  export NODE_ENV=production
  css
  npx next build

  local DEST="$HOME/.config/systemd/user/ethnos-app.service"
  if [ ! -f "$DEST" ]; then
    setup_service
  fi

  if [ "${NO_NGINX:-0}" = "1" ]; then
    echo "Skipping the nginx front door (NO_NGINX=1)."
  else
    nginx_config
  fi

  systemctl --user restart "$SYSTEMD_SERVICE"
  systemctl --user is-active --quiet "$SYSTEMD_SERVICE"

  local waited=0
  while [ "$waited" -lt "$DAEMON_READY_TIMEOUT" ] && ! port_listening "$APP_PORT"; do
    sleep 1
    waited=$((waited + 1))
  done

  echo
  echo "-- Final validation --"
  verify_stack
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

  echo "Setup complete. Use 'scripts/manage.sh deploy' to build, install the nginx front door and start."
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

seo_audit() {
  ensure_node
  resolve_ports
  local TARGET="${SEO_BASE:-http://127.0.0.1:$PUBLIC_PORT}"
  node "$ROOT_DIR/scripts/seo/audit.mjs" --base "$TARGET" "$@"
}

indexnow() {
  ensure_node
  load_env
  node "$ROOT_DIR/scripts/seo/indexnow.mjs" "$@"
}

seo() {
  local SUB="${1:-audit}"
  shift || true
  case "$SUB" in
    audit) seo_audit "$@" ;;
    indexnow|ping) indexnow "$@" ;;
    *)
      echo "Usage: $0 seo {audit|indexnow} [options]" >&2
      exit 1
      ;;
  esac
}

usage() {
  echo "Usage: $0 {css|dev|build|start|start_foreground|stop|restart|clean|cache_clean|check|deps|deploy|nginx [--print]|status|verify|setup_service|uninstall|maintenance [on|off|status]|seo [audit|indexnow]}"
  echo
  echo "Ports: nginx serves :$PUBLIC_PORT and proxies to the app on $APP_BIND_HOST:$APP_PORT (dev: $DEV_HOST:$DEV_PORT)."
}

case "$CMD" in
  css|dev|build|start|start_foreground|stop|restart|clean|cache_clean|check|deps|deploy|setup_service|uninstall|status)
    "$CMD"
    ;;
  nginx)
    shift
    nginx_config "$@"
    ;;
  verify)
    load_env
    verify_stack
    ;;
  maintenance)
    maintenance "$@"
    ;;
  seo)
    shift
    seo "$@"
    ;;
  *)
    usage
    exit 1
    ;;
esac
