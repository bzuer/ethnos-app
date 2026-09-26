#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE_NAME="${SERVICE_NAME:-ethnos-app.service}"
LEGACY_UNITS="ethnos-next.service"
SYSTEM_UNIT_DIR=/etc/systemd/system
SYSTEM_UNIT="$SYSTEM_UNIT_DIR/$SERVICE_NAME"
UNIT_TEMPLATE="$ROOT_DIR/scripts/systemd/ethnos-app.service"
RUN_USER="$(stat -c %U "$ROOT_DIR")"
RUN_GROUP="$(stat -c %G "$ROOT_DIR")"
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6 || true)"
STRAY_USER_UNIT="$RUN_HOME/.config/systemd/user/$SERVICE_NAME"
MAINTENANCE_DROPIN_DIR="$SYSTEM_UNIT_DIR/$SERVICE_NAME.d"
MAINTENANCE_DROPIN="$MAINTENANCE_DROPIN_DIR/maintenance.conf"
ENV_FILE="${ENV_FILE:-/etc/next-frontend.env}"
NGINX_RENDER="$ROOT_DIR/scripts/nginx/render-config.sh"
NEXT_BIN="$ROOT_DIR/node_modules/next/dist/bin/next"
NODE_MIN_MAJOR=20
NODE_MAX_MAJOR=24
READY_TIMEOUT="${READY_TIMEOUT:-60}"

APP_PORT=1202
APP_BIND_HOST=localhost
APP_UPSTREAM_HOST=127.0.0.1
PUBLIC_PORT=1212
NGINX_LISTEN=127.0.0.1
NGINX_CONF_TARGET=/etc/nginx/conf.d/ethnos-app.conf
DEV_PORT=1210
DEV_HOST=localhost

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ERRORS=0

log()  { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; ERRORS=$((ERRORS + 1)); }
step() { echo -e "\n${CYAN}${BOLD}── $* ──${NC}"; }

resolve_topology() {
  APP_PORT="${APP_PORT:-1202}"
  APP_BIND_HOST="${APP_BIND_HOST:-localhost}"
  APP_UPSTREAM_HOST="${APP_UPSTREAM_HOST:-127.0.0.1}"
  PUBLIC_PORT="${NGINX_PUBLIC_PORT:-1212}"
  NGINX_LISTEN="${NGINX_LISTEN_ADDRESS-127.0.0.1}"
  NGINX_CONF_TARGET="${NGINX_APP_CONF:-/etc/nginx/conf.d/ethnos-app.conf}"
  DEV_PORT="${DEV_PORT:-1210}"
  DEV_HOST="${DEV_HOST:-localhost}"
}

read_env_file() {
  set -a
  source "$ENV_FILE"
  set +a
  resolve_topology
}

load_env() {
  if [ ! -r "$ENV_FILE" ]; then
    err "$ENV_FILE not found or not readable"
    return 1
  fi
  read_env_file

  if [ "$APP_PORT" = "$PUBLIC_PORT" ]; then
    err "APP_PORT ($APP_PORT) equals NGINX_PUBLIC_PORT ($PUBLIC_PORT) in $ENV_FILE — nginx must own the public port and proxy to a separate application port"
    return 1
  fi
  if [ "$APP_BIND_HOST" != "localhost" ]; then
    err "APP_BIND_HOST is '$APP_BIND_HOST' — it must be 'localhost': with an IP literal Next treats every middleware rewrite as external and the default-locale URLs loop (307 to themselves, 500 behind TLS)"
    return 1
  fi
}

load_env_optional() {
  if [ -r "$ENV_FILE" ]; then
    read_env_file
  else
    resolve_topology
  fi
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1 && { sudo -n true 2>/dev/null || [ -t 0 ]; }; then
    sudo "$@"
  else
    err "root required for: $* — rerun with sudo"
    return 1
  fi
}

run_as_owner() {
  if [ "$(id -un)" = "$RUN_USER" ]; then
    "$@"
  elif [ "$(id -u)" -eq 0 ]; then
    runuser -u "$RUN_USER" -- env XDG_RUNTIME_DIR="/run/user/$(id -u "$RUN_USER")" "$@"
  else
    return 1
  fi
}

node_major() {
  local version
  version="$(node -v 2>/dev/null || true)"
  version="${version#v}"
  printf '%s' "${version%%.*}"
}

node_supported() {
  local major="${1:-}"
  case "$major" in ''|*[!0-9]*) return 1 ;; esac
  [ "$major" -ge "$NODE_MIN_MAJOR" ] && [ "$major" -le "$NODE_MAX_MAJOR" ]
}

nvm_node_bin() {
  local root="${NVM_DIR:-$RUN_HOME/.nvm}/versions/node"
  [ -d "$root" ] || return 1
  local wanted="" dir major best="" best_wanted=""
  if [ -f "$ROOT_DIR/.nvmrc" ]; then
    wanted="$(tr -d ' \t\r\nv' < "$ROOT_DIR/.nvmrc")"
    wanted="${wanted%%.*}"
  fi
  for dir in $(ls -1 "$root" 2>/dev/null | sort -V); do
    [ -x "$root/$dir/bin/node" ] || continue
    major="${dir#v}"
    major="${major%%.*}"
    node_supported "$major" || continue
    best="$root/$dir/bin"
    [ -n "$wanted" ] && [ "$major" = "$wanted" ] && best_wanted="$root/$dir/bin"
  done
  best="${best_wanted:-$best}"
  [ -n "$best" ] || return 1
  printf '%s' "$best"
}

ensure_node() {
  local bin_dir
  if [ -n "${NODE_BIN:-}" ]; then
    bin_dir="$NODE_BIN"
    [ -d "$bin_dir" ] || bin_dir="$(dirname "$bin_dir")"
    export PATH="$bin_dir:$PATH"
  fi
  node_supported "$(node_major)" && return 0

  if bin_dir="$(nvm_node_bin)"; then
    export PATH="$bin_dir:$PATH"
    node_supported "$(node_major)" && return 0
  fi

  err "Node >=$NODE_MIN_MAJOR <$((NODE_MAX_MAJOR + 1)) is required (package.json#engines); found $(node -v 2>/dev/null || echo none) — run 'nvm install $NODE_MAX_MAJOR' or set NODE_BIN"
  exit 1
}

port_listening() {
  [ -n "$(ss -lntH "sport = :$1" 2>/dev/null || true)" ]
}

port_addresses() {
  ss -lntH "sport = :$1" 2>/dev/null | awk '{print $4}' | tr '\n' ' ' | sed 's/ $//' || true
}

port_exposed() {
  ss -lntH "sport = :$1" 2>/dev/null | awk '{print $4}' | grep -vE '^(127\.|\[::1\]|\[::ffff:127\.)' || true
}

port_pids() {
  ss -lntpH "sport = :$1" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u | tr '\n' ' ' | sed 's/ $//' || true
}

service_pid() {
  systemctl show "$SERVICE_NAME" --property=MainPID --value 2>/dev/null || echo 0
}

stray_units() {
  local found="" unit
  for unit in $LEGACY_UNITS; do
    [ -n "$(systemctl list-unit-files --no-legend "$unit" 2>/dev/null || true)" ] && found="$found $unit"
  done
  if [ -e "$STRAY_USER_UNIT" ]; then
    found="$found $STRAY_USER_UNIT"
  fi
  printf '%s' "${found# }"
}

remove_stray_user_unit() {
  [ -e "$STRAY_USER_UNIT" ] || [ -e "$STRAY_USER_UNIT.d" ] || return 0
  warn "Removing user-scope $SERVICE_NAME (the app runs only as the system unit)"
  run_as_owner systemctl --user disable --now "$SERVICE_NAME" 2>/dev/null || true
  if [ -f "$STRAY_USER_UNIT.d/maintenance.conf" ]; then
    warn "The user unit had maintenance mode on — re-enable it with 'scripts/manage.sh maintenance on' if still wanted"
  fi
  rm -rf "$STRAY_USER_UNIT" "$STRAY_USER_UNIT.d" 2>/dev/null || as_root rm -rf "$STRAY_USER_UNIT" "$STRAY_USER_UNIT.d"
  run_as_owner systemctl --user daemon-reload 2>/dev/null || true
  run_as_owner systemctl --user reset-failed "$SERVICE_NAME" 2>/dev/null || true
}

kill_rogue_app_processes() {
  local pids main pid
  pids="$(port_pids "$APP_PORT")"
  [ -n "$pids" ] || return 0
  main="$(service_pid)"
  for pid in $pids; do
    [ "$pid" = "$main" ] && systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null && continue
    warn "Killing rogue process on port $APP_PORT (PID: $pid)"
    kill "$pid" 2>/dev/null || as_root kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || as_root kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

render_unit() {
  ensure_node
  local node_bin
  node_bin="$(command -v node)"
  sed \
    -e "s|__NODE_BIN__|${node_bin}|g" \
    -e "s|__NODE_DIR__|$(dirname "$node_bin")|g" \
    -e "s|__NEXT_BIN__|${NEXT_BIN}|g" \
    -e "s|__WORKDIR__|${ROOT_DIR}|g" \
    -e "s|__RUN_USER__|${RUN_USER}|g" \
    -e "s|__RUN_GROUP__|${RUN_GROUP}|g" \
    -e "s|__ENV_FILE__|${ENV_FILE}|g" \
    -e "s|__BIND_HOST__|${APP_BIND_HOST}|g" \
    -e "s|__APP_PORT__|${APP_PORT}|g" \
    "$UNIT_TEMPLATE"
}

unit_is_current() {
  [ -r "$SYSTEM_UNIT" ] || return 1
  [ "$(render_unit 2>/dev/null)" = "$(cat "$SYSTEM_UNIT")" ]
}

wait_for_app() {
  local waited=0
  while [ "$waited" -lt "$READY_TIMEOUT" ]; do
    if curl -s -o /dev/null --max-time 5 "http://${APP_UPSTREAM_HOST}:${APP_PORT}/" 2>/dev/null; then
      log "App answering on ${APP_UPSTREAM_HOST}:${APP_PORT} after ${waited}s"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  warn "App did not answer on ${APP_UPSTREAM_HOST}:${APP_PORT} within ${READY_TIMEOUT}s"
  return 1
}

check_app() {
  step "App service"

  remove_stray_user_unit
  kill_rogue_app_processes

  if [ ! -f "$SYSTEM_UNIT" ]; then
    warn "$SERVICE_NAME not installed — running systemd:install"
    cmd_systemd_install
  fi

  if [ ! -f "$ROOT_DIR/.next/BUILD_ID" ]; then
    err "No production build in $ROOT_DIR/.next — run: scripts/manage.sh deploy"
    return 1
  fi

  as_root systemctl restart "$SERVICE_NAME"

  if ! systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    err "$SERVICE_NAME failed to start"
    journalctl -u "$SERVICE_NAME" --no-pager -n 20 2>/dev/null || true
    return 1
  fi
  log "systemd service $SERVICE_NAME is active (PID $(service_pid))"

  wait_for_app || true
  assert_upstream_is_private
}

assert_upstream_is_private() {
  local exposed
  exposed="$(port_exposed "$APP_PORT")"
  if [ -n "$exposed" ]; then
    err "App port ${APP_PORT} is bound outside loopback ($(echo $exposed)) — APP_BIND_HOST must be localhost so nginx stays the only public listener"
    return 1
  fi
}

render_nginx_conf() {
  ENV_FILE="$ENV_FILE" "$NGINX_RENDER" --print
}

nginx_conf_is_current() {
  [ -r "$NGINX_CONF_TARGET" ] || return 1
  local rendered
  rendered="$(render_nginx_conf 2>/dev/null)" || return 1
  [ "$rendered" = "$(cat "$NGINX_CONF_TARGET")" ]
}

install_nginx_conf() {
  if [ ! -x "$NGINX_RENDER" ]; then
    err "Renderer not found or not executable: $NGINX_RENDER"
    return 1
  fi
  as_root env ENV_FILE="$ENV_FILE" "$NGINX_RENDER"
}

public_bind_matches() {
  local addrs
  addrs="$(port_addresses "$PUBLIC_PORT")"
  [ -n "$addrs" ] || return 1
  if [ -n "$NGINX_LISTEN" ] && printf '%s\n' $addrs | grep -qE "^(0\.0\.0\.0|\[::\]):${PUBLIC_PORT}\$"; then
    return 1
  fi
  return 0
}

public_server_header() {
  curl -sI --max-time 20 -H "Host: ${VERIFY_HOST:-ethnos.app}" "http://127.0.0.1:${PUBLIC_PORT}/" 2>/dev/null \
    | awk 'tolower($1) == "server:" {print tolower($2)}' | tr -d '\r' || true
}

check_nginx() {
  step "Nginx"

  if ! command -v nginx >/dev/null 2>&1; then
    err "nginx is not installed — the app must not be published without it"
    return 1
  fi
  if ! systemctl is-active --quiet nginx 2>/dev/null; then
    err "nginx service is not active — run: sudo systemctl start nginx"
    return 1
  fi
  if [ ! -r "$NGINX_CONF_TARGET" ]; then
    err "$NGINX_CONF_TARGET is missing — run: scripts/manage.sh nginx"
    return 1
  fi
  if nginx_conf_is_current; then
    log "nginx vhost current ($NGINX_CONF_TARGET)"
  else
    err "$NGINX_CONF_TARGET differs from the rendered config — run: scripts/manage.sh nginx"
  fi
  if ! port_listening "$PUBLIC_PORT"; then
    err "Nothing is listening on the public port ${PUBLIC_PORT}"
    return 1
  fi

  local server_header
  server_header="$(public_server_header)"
  case "$server_header" in
    nginx*) log "Public port ${PUBLIC_PORT} served by nginx → ${APP_UPSTREAM_HOST}:${APP_PORT}" ;;
    "")     warn "Public port ${PUBLIC_PORT} did not answer (is the app up?)" ;;
    *)      err "Public port ${PUBLIC_PORT} is answered by '${server_header}', not nginx" ;;
  esac
}

ensure_nginx() {
  step "Nginx"

  if ! command -v nginx >/dev/null 2>&1; then
    err "nginx is not installed — the app must not be published without it"
    return 1
  fi

  if nginx_conf_is_current && public_bind_matches; then
    log "nginx vhost already current ($NGINX_CONF_TARGET)"
  else
    log "Installing nginx vhost → $NGINX_CONF_TARGET"
    install_nginx_conf || return 1
  fi

  if ! systemctl is-active --quiet nginx 2>/dev/null; then
    warn "nginx is not active — attempting start"
    as_root systemctl start nginx || true
  fi

  if systemctl is-active --quiet nginx 2>/dev/null; then
    log "nginx active on ${PUBLIC_PORT} → ${APP_UPSTREAM_HOST}:${APP_PORT}"
  else
    err "nginx failed to start — run: sudo systemctl start nginx"
    return 1
  fi
}

clean_build() {
  rm -rf "$ROOT_DIR/.next" "$ROOT_DIR/.turbo" "$ROOT_DIR/node_modules/.cache" 2>/dev/null || true
}

clean_cache() {
  rm -rf "$ROOT_DIR/.next/cache" "$ROOT_DIR/.turbo" "$ROOT_DIR/node_modules/.cache" 2>/dev/null || true
}

install_deps() {
  ensure_node
  log "Installing dependencies"
  if [ -f "$ROOT_DIR/package-lock.json" ]; then
    NODE_ENV=development npm ci --no-fund --audit=false 2>&1 | tail -3
  else
    NODE_ENV=development npm install --no-fund --audit=false 2>&1 | tail -3
  fi
}

build_css() {
  ensure_node
  log "Building CSS"
  node "$ROOT_DIR/scripts/build-css.mjs"
}

build_app() {
  ensure_node
  build_css
  log "Building Next.js (production)"
  NODE_ENV=production "$NEXT_BIN" build
}

validate_all() {
  step "Final validation"
  local ok=0 fail=0

  pass() { echo -e "  [OK] $*"; ok=$((ok + 1)); }
  flunk() { echo -e "  [FAIL] $*"; fail=$((fail + 1)); }

  local main_pid listeners
  main_pid="$(service_pid)"
  listeners="$(port_pids "$APP_PORT")"
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null \
     && [ "${main_pid:-0}" != "0" ] && [ "$listeners" = "$main_pid" ]; then
    pass "systemd service ($SERVICE_NAME, PID $main_pid owns port ${APP_PORT})"
  else
    flunk "systemd service ($SERVICE_NAME) does not own port ${APP_PORT} (unit PID ${main_pid:-0}, listener PID(s) ${listeners:-none})"
  fi

  if unit_is_current; then
    pass "system unit current ($SYSTEM_UNIT)"
  else
    flunk "system unit missing or stale ($SYSTEM_UNIT) — run: scripts/manage.sh systemd:install"
  fi

  local stray
  stray="$(stray_units)"
  if [ -z "$stray" ]; then
    pass "single app unit (system scope only)"
  else
    flunk "duplicate unit(s) present: $stray — run: scripts/manage.sh systemd:install (legacy system units must be disabled and deleted)"
  fi

  local restarts
  restarts="$(systemctl show "$SERVICE_NAME" --property=NRestarts --value 2>/dev/null || echo 0)"
  if [ "${restarts:-0}" -gt 0 ] 2>/dev/null; then
    warn "$SERVICE_NAME has restarted ${restarts} time(s) since it was last started — check: journalctl -u $SERVICE_NAME"
  fi

  if [ -z "$(port_exposed "$APP_PORT")" ] && port_listening "$APP_PORT"; then
    pass "app port ${APP_PORT} bound to loopback only"
  else
    flunk "app port ${APP_PORT} not listening or reachable outside nginx ($(port_addresses "$APP_PORT"))"
  fi

  if systemctl is-active --quiet nginx 2>/dev/null; then
    pass "nginx service"
  else
    flunk "nginx service"
  fi

  if nginx_conf_is_current; then
    pass "nginx vhost current ($NGINX_CONF_TARGET)"
  else
    flunk "nginx vhost missing or stale ($NGINX_CONF_TARGET) — run: scripts/manage.sh nginx"
  fi

  local addrs
  addrs="$(port_addresses "$PUBLIC_PORT")"
  if [ -z "$addrs" ]; then
    flunk "nothing is listening on the public port ${PUBLIC_PORT}"
  elif ! public_bind_matches; then
    flunk "port ${PUBLIC_PORT} is bound to ${addrs} but the vhost asks for ${NGINX_LISTEN} — nginx keeps the old socket across a reload; run: sudo systemctl restart nginx"
  else
    pass "nginx public (port ${PUBLIC_PORT} on ${addrs})"
  fi

  local probe code redirect rpath
  probe="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 \
    -H "Host: ${VERIFY_HOST:-ethnos.app}" -H 'X-Forwarded-Proto: https' \
    "http://127.0.0.1:${PUBLIC_PORT}/" 2>/dev/null || true)"
  code="${probe%% *}"
  code="${code:-000}"
  redirect="${probe#* }"
  case "$code" in
    200) pass "home page through nginx (:${PUBLIC_PORT}/ → HTTP 200)" ;;
    503) pass "home page through nginx (:${PUBLIC_PORT}/ → HTTP 503, maintenance mode)" ;;
    3??)
      rpath="${redirect#*://}"
      [ "$rpath" = "$redirect" ] || rpath="/${rpath#*/}"
      if [ "$rpath" = "/" ]; then
        flunk "home page redirects to itself ($code → ${redirect:-/}) — APP_BIND_HOST must be 'localhost'"
      else
        pass "home page through nginx (:${PUBLIC_PORT}/ → HTTP $code → $redirect)"
      fi
      ;;
    2??) pass "home page through nginx (:${PUBLIC_PORT}/ → HTTP $code)" ;;
    *) flunk "home page through nginx (:${PUBLIC_PORT}/ → HTTP $code)" ;;
  esac

  if [ -f "$MAINTENANCE_DROPIN" ]; then
    warn "maintenance mode is ON ($MAINTENANCE_DROPIN)"
  fi

  echo ""
  if [ "$fail" -eq 0 ]; then
    log "All $ok checks passed"
  else
    err "$fail check(s) failed, $ok passed"
  fi
  return "$fail"
}

cmd_deploy() {
  step "Deploy"
  load_env
  ensure_node
  as_root true

  ensure_nginx

  log "Stopping app"
  as_root systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  kill_rogue_app_processes

  clean_build
  install_deps
  build_app

  cmd_systemd_install
  check_app || true
  check_nginx || true

  validate_all
}

cmd_restart() {
  step "Restart"
  load_env
  ensure_nginx
  check_app || true
  validate_all
}

cmd_start() {
  load_env
  ensure_nginx
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    step "App service"
    log "systemd service $SERVICE_NAME already active (PID $(service_pid))"
    remove_stray_user_unit
  else
    check_app || true
  fi
  validate_all
}

cmd_stop() {
  load_env
  step "Stopping app"
  as_root systemctl stop "$SERVICE_NAME" || true
  kill_rogue_app_processes
  log "App stopped (nginx keeps the public port and answers 502)"
}

cmd_status() {
  load_env
  check_nginx || true
  validate_all
}

cmd_nginx() {
  load_env
  if [ "${1:-}" = "--print" ]; then
    render_nginx_conf
    return
  fi
  step "Nginx"
  install_nginx_conf
}

cmd_systemd_install() {
  step "Systemd unit"
  load_env

  if [ ! -f "$UNIT_TEMPLATE" ]; then
    err "Service template not found: $UNIT_TEMPLATE"
    return 1
  fi
  if [ "$RUN_USER" = "root" ] || [ -z "$RUN_HOME" ]; then
    err "Refusing to run the app as '$RUN_USER' — the checkout must be owned by an unprivileged user"
    return 1
  fi

  local rendered
  rendered="$(mktemp)"
  render_unit > "$rendered"

  remove_stray_user_unit

  if [ -f "$SYSTEM_UNIT" ] && cmp -s "$rendered" "$SYSTEM_UNIT"; then
    rm -f "$rendered"
    log "$SYSTEM_UNIT already current"
  else
    as_root install -m 0644 -o root -g root "$rendered" "$SYSTEM_UNIT" || { rm -f "$rendered"; return 1; }
    rm -f "$rendered"
    as_root systemctl daemon-reload
    log "Installed $SERVICE_NAME → $SYSTEM_UNIT (runs as $RUN_USER, node $(command -v node))"
  fi
  as_root systemctl enable --quiet "$SERVICE_NAME"
}

cmd_uninstall() {
  step "Uninstall"
  load_env_optional

  step "Stopping app"
  as_root systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  kill_rogue_app_processes

  step "Removing systemd service"
  remove_stray_user_unit
  if [ -f "$SYSTEM_UNIT" ]; then
    as_root systemctl disable "$SERVICE_NAME" || true
    as_root rm -rf "$SYSTEM_UNIT" "$MAINTENANCE_DROPIN_DIR"
    as_root systemctl daemon-reload
    as_root systemctl reset-failed "$SERVICE_NAME" 2>/dev/null || true
    log "Removed $SYSTEM_UNIT"
  else
    warn "Service file not found: $SYSTEM_UNIT"
  fi

  step "Removing nginx vhost"
  if [ -e "$NGINX_CONF_TARGET" ]; then
    as_root rm -f "$NGINX_CONF_TARGET" && as_root systemctl reload nginx 2>/dev/null || true
    log "Removed $NGINX_CONF_TARGET"
  else
    warn "nginx vhost not found: $NGINX_CONF_TARGET"
  fi

  step "Removing build artifacts and dependencies"
  clean_build
  rm -rf "$ROOT_DIR/node_modules" 2>/dev/null || true
  log "Removed .next, .turbo and node_modules"

  echo ""
  log "Uninstall complete — source code preserved in $ROOT_DIR"
}

cmd_maintenance() {
  case "${1:-status}" in
    on|enable)
      as_root mkdir -p "$MAINTENANCE_DROPIN_DIR"
      printf '[Service]\nEnvironment=MAINTENANCE_MODE=1\n' | as_root tee "$MAINTENANCE_DROPIN" >/dev/null
      as_root systemctl daemon-reload
      log "Wrote $MAINTENANCE_DROPIN"
      if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        as_root systemctl restart "$SERVICE_NAME"
        log "Restarted $SERVICE_NAME with MAINTENANCE_MODE=1"
      else
        warn "$SERVICE_NAME is not active — run: scripts/manage.sh start"
      fi
      ;;
    off|disable)
      if [ -f "$MAINTENANCE_DROPIN" ]; then
        as_root rm -f "$MAINTENANCE_DROPIN"
        as_root rmdir "$MAINTENANCE_DROPIN_DIR" 2>/dev/null || true
        as_root systemctl daemon-reload
        log "Removed $MAINTENANCE_DROPIN"
      else
        log "Maintenance flag was not set"
      fi
      if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        as_root systemctl restart "$SERVICE_NAME"
        log "Restarted $SERVICE_NAME"
      fi
      ;;
    status)
      if [ -f "$MAINTENANCE_DROPIN" ]; then
        echo "maintenance: ON ($MAINTENANCE_DROPIN)"
      else
        echo "maintenance: OFF"
      fi
      if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "service: active"
      else
        echo "service: inactive"
      fi
      ;;
    *) err "Usage: manage.sh maintenance {on|off|status}"; return 1 ;;
  esac
}

cmd_seo() {
  local sub="${1:-audit}"
  shift || true
  ensure_node
  case "$sub" in
    audit)
      load_env_optional
      node "$ROOT_DIR/scripts/seo/audit.mjs" --base "${SEO_BASE:-http://127.0.0.1:$PUBLIC_PORT}" "$@"
      ;;
    indexnow|ping)
      load_env_optional
      node "$ROOT_DIR/scripts/seo/indexnow.mjs" "$@"
      ;;
    *) err "Usage: manage.sh seo {audit|indexnow} [options]"; return 1 ;;
  esac
}

cmd_dev() {
  ensure_node
  load_env_optional
  build_css
  exec "$NEXT_BIN" dev -H "$DEV_HOST" -p "${PORT:-$DEV_PORT}"
}

cmd_build() {
  load_env_optional
  build_app
}

cmd_start_foreground() {
  ensure_node
  load_env_optional
  if [ ! -x "$NEXT_BIN" ]; then
    err "Missing Next binary at $NEXT_BIN — run: npm ci"
    exit 1
  fi
  export NODE_ENV=production
  exec "$NEXT_BIN" start -H "$APP_BIND_HOST" -p "$APP_PORT"
}

cmd_check() {
  ensure_node
  node -v
  npm -v
  "$NEXT_BIN" --version || true
  [ -f "$ROOT_DIR/public/css/styles.css" ] || { err "Missing public/css/styles.css"; return 1; }
}

usage() {
  cat <<'USAGE'
Ethnos App — unified control script

Usage: manage.sh <command> [options]

Lifecycle (with automatic verification):
  deploy              Full deploy: nginx → stop app → clean → deps → css → build → unit → start + validate
  restart             Restart the system unit (no rebuild), repair nginx, validate
  start               Install/repair the nginx vhost, start the app if it is not running, validate
  stop                Stop the app (nginx keeps the public port and answers 502)
  status | verify     Validate the whole topology and report (never writes to /etc)

Nginx (the app is only ever published through it):
  nginx               Render and install the vhost, nginx -t, reload (needs sudo)
  nginx --print       Print the rendered vhost without installing it

Systemd:
  systemd:install     Install/refresh the system unit /etc/systemd/system/ethnos-app.service
                      (needs sudo; removes any user-scope copy — the app runs as exactly one system unit)
  uninstall           Stop the app, remove the unit, vhost, build artifacts and node_modules

Maintenance:
  maintenance on|off|status   Toggle MAINTENANCE_MODE via a systemd drop-in (needs sudo)

Build & development:
  build               CSS + production build (does not restart)
  css                 Regenerate public/css/styles.min.css
  deps                npm ci
  clean               Remove .next, .turbo and caches
  cache_clean         Remove only the build caches
  dev                 next dev on localhost:1210
  check               Print node/npm/next versions
  start_foreground    Run next start in the foreground (for non-systemd service managers)

SEO:
  seo audit           SEO conformance audit (SEO_BASE=… to retarget)
  seo indexnow        Submit URLs to IndexNow

USAGE
}

main() {
  local cmd="${1:-}"
  shift || true

  case "$cmd" in
    deploy)                        cmd_deploy ;;
    restart)                       cmd_restart ;;
    start)                         cmd_start ;;
    stop)                          cmd_stop ;;
    status|verify)                 cmd_status ;;
    nginx|nginx:install)           cmd_nginx "${1:-}" ;;
    systemd:install|setup_service) cmd_systemd_install ;;
    uninstall)                     cmd_uninstall ;;
    maintenance)                   cmd_maintenance "${1:-status}" ;;
    seo)                           cmd_seo "$@" ;;
    build)                         cmd_build ;;
    css)                           build_css ;;
    deps)                          install_deps ;;
    clean)                         clean_build ;;
    cache_clean)                   clean_cache ;;
    dev)                           cmd_dev ;;
    check)                         cmd_check ;;
    start_foreground)              cmd_start_foreground ;;
    help|--help|-h|'')             usage ;;
    *)                             err "Unknown command: $cmd"; usage; exit 1 ;;
  esac
}

main "$@"
