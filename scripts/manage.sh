#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE=ethnos-app.service
UNIT_DIR=/etc/systemd/system
DROPIN="$UNIT_DIR/$SERVICE.d/maintenance.conf"
INDEXNOW_UNITS="ethnos-indexnow.service ethnos-indexnow.timer"
ENV_FILE="${ENV_FILE:-/etc/next-frontend.env}"
NEXT_BIN="$ROOT_DIR/node_modules/next/dist/bin/next"
RENDER_NGINX="$ROOT_DIR/scripts/nginx/render-config.sh"
RUN_USER="$(stat -c %U "$ROOT_DIR")"
RUN_GROUP="$(stat -c %G "$ROOT_DIR")"
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
READY_TIMEOUT="${READY_TIMEOUT:-60}"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

load_env() {
  if [ -r "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
  elif [ "${1:-}" = required ]; then
    die "$ENV_FILE is missing or unreadable"
  fi
  APP_PORT="${APP_PORT:-1202}"
  APP_BIND_HOST="${APP_BIND_HOST:-localhost}"
  PUBLIC_PORT="${NGINX_PUBLIC_PORT:-1212}"
  NGINX_CONF="${NGINX_APP_CONF:-/etc/nginx/conf.d/ethnos-app.conf}"
  [ "$APP_BIND_HOST" = localhost ] || die "APP_BIND_HOST must be localhost"
}

use_node() {
  local dir="" major
  if [ -n "${NODE_BIN:-}" ]; then
    dir="$NODE_BIN"
    [ -d "$dir" ] || dir="$(dirname "$dir")"
  else
    dir="$(ls -d "${NVM_DIR:-$RUN_HOME/.nvm}"/versions/node/v2[0-4].*/bin 2>/dev/null | sort -V | tail -1 || true)"
  fi
  if [ -n "$dir" ]; then export PATH="$dir:$PATH"; fi
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$major" -ge 20 ] && [ "$major" -le 24 ] || die "Node 20–24 is required (found $(node -v 2>/dev/null || echo none)); set NODE_BIN"
}

indexnow_on() {
  case "${INDEXNOW_AUTOSUBMIT:-}" in 1|true|on|yes) return 0 ;; *) return 1 ;; esac
}

render_unit() {
  local node_bin
  node_bin="$(command -v node)"
  sed -e "s|__NODE_BIN__|$node_bin|g" -e "s|__NODE_DIR__|$(dirname "$node_bin")|g" \
      -e "s|__NEXT_BIN__|$NEXT_BIN|g" -e "s|__WORKDIR__|$ROOT_DIR|g" \
      -e "s|__RUN_USER__|$RUN_USER|g" -e "s|__RUN_GROUP__|$RUN_GROUP|g" \
      -e "s|__ENV_FILE__|$ENV_FILE|g" -e "s|__BIND_HOST__|$APP_BIND_HOST|g" \
      -e "s|__APP_PORT__|$APP_PORT|g" -e "s|__PUBLIC_PORT__|$PUBLIC_PORT|g" \
      "$ROOT_DIR/scripts/systemd/$1"
}

install_if_changed() {
  if [ -f "$2" ] && [ "$(cat "$2")" = "$1" ]; then return 1; fi
  printf '%s\n' "$1" | as_root install -m 0644 -o root -g root /dev/stdin "$2"
}

build_css() {
  node "$ROOT_DIR/scripts/build-css.mjs"
}

build_app() {
  build_css
  NODE_ENV=production "$NEXT_BIN" build
}

sync_nginx() {
  local rendered
  rendered="$(ENV_FILE="$ENV_FILE" "$RENDER_NGINX" --print)"
  if [ -f "$NGINX_CONF" ] && [ "$(cat "$NGINX_CONF")" = "$rendered" ]; then return 0; fi
  as_root env ENV_FILE="$ENV_FILE" "$RENDER_NGINX"
}

sync_units() {
  local unit changed=0
  [ "$RUN_USER" != root ] || die "the checkout must be owned by an unprivileged user"
  if install_if_changed "$(render_unit "$SERVICE")" "$UNIT_DIR/$SERVICE"; then changed=1; fi
  for unit in $INDEXNOW_UNITS; do
    if indexnow_on; then
      if install_if_changed "$(render_unit "$unit")" "$UNIT_DIR/$unit"; then changed=1; fi
    elif [ -e "$UNIT_DIR/$unit" ]; then
      as_root systemctl disable --now "$unit" 2>/dev/null || true
      as_root rm -f "$UNIT_DIR/$unit"
      changed=1
    fi
  done
  if [ "$changed" -eq 1 ]; then as_root systemctl daemon-reload; fi
  as_root systemctl enable --quiet "$SERVICE"
  if indexnow_on; then as_root systemctl enable --now --quiet ethnos-indexnow.timer; fi
  log "systemd units current"
}

start_app() {
  [ -f "$ROOT_DIR/.next/BUILD_ID" ] || die "no production build — run: scripts/manage.sh deploy"
  as_root systemctl restart "$SERVICE"
  local deadline=$((SECONDS + READY_TIMEOUT))
  until curl -s -o /dev/null --max-time 5 "http://127.0.0.1:$APP_PORT/"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      log "app not answering on :$APP_PORT after ${READY_TIMEOUT}s — see: journalctl -u $SERVICE"
      return 0
    fi
    sleep 1
  done
  log "app answering on :$APP_PORT"
}

cmd_deploy() {
  load_env required
  use_node
  as_root true
  sync_nginx
  log "stopping the app for the build"
  as_root systemctl stop "$SERVICE" 2>/dev/null || true
  rm -rf "$ROOT_DIR/.next" "$ROOT_DIR/.turbo" "$ROOT_DIR/node_modules/.cache"
  log "installing dependencies"
  NODE_ENV=development npm ci --no-fund --audit=false 2>&1 | tail -3
  log "building"
  build_app
  sync_units
  start_app
}

cmd_start() {
  load_env required
  sync_nginx
  if systemctl is-active --quiet "$SERVICE"; then
    log "$SERVICE already active"
  else
    start_app
  fi
}

cmd_restart() {
  load_env required
  sync_nginx
  start_app
}

cmd_stop() {
  as_root systemctl stop "$SERVICE"
  log "$SERVICE stopped (nginx answers 502 until it starts again)"
}

cmd_status() {
  load_env
  systemctl status "$SERVICE" --no-pager --lines=0 || true
  if [ -f "$DROPIN" ]; then echo "maintenance: on"; fi
  curl -s -o /dev/null -w "home via nginx: HTTP %{http_code} in %{time_total}s\n" --max-time 10 "http://127.0.0.1:$PUBLIC_PORT/" || echo "home via nginx: no answer"
}

cmd_nginx() {
  load_env
  if [ "${1:-}" = --print ]; then
    ENV_FILE="$ENV_FILE" "$RENDER_NGINX" --print
  else
    as_root env ENV_FILE="$ENV_FILE" "$RENDER_NGINX"
  fi
}

cmd_systemd() {
  load_env required
  use_node
  sync_units
}

cmd_maintenance() {
  case "${1:-status}" in
    on)
      printf '[Service]\nEnvironment=MAINTENANCE_MODE=1\n' | as_root install -D -m 0644 /dev/stdin "$DROPIN"
      as_root systemctl daemon-reload
      as_root systemctl restart "$SERVICE"
      log "maintenance on"
      ;;
    off)
      as_root rm -f "$DROPIN"
      as_root systemctl daemon-reload
      as_root systemctl restart "$SERVICE"
      log "maintenance off"
      ;;
    status)
      if [ -f "$DROPIN" ]; then echo "maintenance: on"; else echo "maintenance: off"; fi
      ;;
    *) die "usage: manage.sh maintenance {on|off|status}" ;;
  esac
}

cmd_uninstall() {
  load_env
  as_root systemctl disable --now "$SERVICE" 2>/dev/null || true
  as_root systemctl disable --now ethnos-indexnow.timer 2>/dev/null || true
  as_root rm -rf "$UNIT_DIR/$SERVICE" "$UNIT_DIR/$SERVICE.d" "$UNIT_DIR/ethnos-indexnow.service" "$UNIT_DIR/ethnos-indexnow.timer" "$NGINX_CONF"
  as_root systemctl daemon-reload
  as_root systemctl reload nginx 2>/dev/null || true
  rm -rf "$ROOT_DIR/.next" "$ROOT_DIR/.turbo" "$ROOT_DIR/node_modules"
  log "removed the units, the nginx vhost, .next and node_modules"
}

cmd_seo() {
  local sub="${1:-audit}"
  shift || true
  load_env
  use_node
  case "$sub" in
    audit) node scripts/seo/audit.mjs --base "${SEO_BASE:-http://127.0.0.1:$PUBLIC_PORT}" "$@" ;;
    indexnow) node scripts/seo/indexnow.mjs "$@" ;;
    indexnow:new) node scripts/seo/indexnow.mjs --source "http://127.0.0.1:$PUBLIC_PORT" --section all --new "$@" ;;
    *) die "usage: manage.sh seo {audit|indexnow|indexnow:new} [options]" ;;
  esac
}

usage() {
  cat <<'USAGE'
usage: scripts/manage.sh <command>

  deploy                    stop, clean, npm ci, css, build, install units, start
  start | stop | restart    control the ethnos-app system unit
  status                    unit state and one request through nginx
  nginx [--print]           render and install the vhost (--print: render only)
  systemd:install           install the unit (and the IndexNow timer when INDEXNOW_AUTOSUBMIT=1)
  maintenance on|off|status toggle MAINTENANCE_MODE through a systemd drop-in
  uninstall                 remove units, vhost, .next and node_modules
  seo audit|indexnow|indexnow:new
  dev | build | css | deps | clean
USAGE
}

case "${1:-}" in
  deploy) cmd_deploy ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_restart ;;
  status) cmd_status ;;
  nginx) cmd_nginx "${2:-}" ;;
  systemd:install) cmd_systemd ;;
  maintenance) cmd_maintenance "${2:-status}" ;;
  uninstall) cmd_uninstall ;;
  seo) shift; cmd_seo "$@" ;;
  dev) load_env; use_node; build_css; exec "$NEXT_BIN" dev -H localhost -p "${PORT:-1210}" ;;
  build) load_env; use_node; build_app ;;
  css) use_node; build_css ;;
  deps) use_node; NODE_ENV=development npm ci --no-fund --audit=false ;;
  clean) rm -rf "$ROOT_DIR/.next" "$ROOT_DIR/.turbo" "$ROOT_DIR/node_modules/.cache" ;;
  help|-h|--help|'') usage ;;
  *) usage; exit 1 ;;
esac
