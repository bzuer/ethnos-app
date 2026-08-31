#!/usr/bin/env bash
#
# Render config/nginx.conf into the live nginx vhost that fronts the frontend,
# taking the port topology from /etc/next-frontend.env. The Next server listens
# on loopback only; this config is what makes the public app port reachable, so
# the application is never published except through nginx.
#
#   scripts/nginx/render-config.sh --print   # print the rendered config, no root
#   sudo scripts/nginx/render-config.sh      # install, nginx -t, reload
#
# A config nginx rejects is never left on disk: the previous file is restored
# (or the new one removed) before the script exits non-zero, so the next reload
# of any other site on this server still succeeds.
#
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/next-frontend.env}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${REPO_ROOT}/config/nginx.conf"

PRINT_ONLY=0
[ "${1:-}" = "--print" ] && PRINT_ONLY=1

[ -f "$SRC" ] || { echo "missing source template: $SRC" >&2; exit 1; }

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [ "$PRINT_ONLY" -eq 0 ]; then
  echo "missing env file: $ENV_FILE" >&2
  exit 1
fi

DEST="${NGINX_APP_CONF:-/etc/nginx/conf.d/ethnos-app.conf}"
PUBLIC_PORT="${NGINX_PUBLIC_PORT:-1212}"
LISTEN_ADDRESS="${NGINX_LISTEN_ADDRESS:-}"
SERVER_NAME="${NGINX_SERVER_NAME:-_}"
# The address nginx dials, which is not necessarily the string the app binds:
# APP_BIND_HOST must be `localhost` (see scripts/manage.sh#resolve_ports), and
# that resolves here to its address.
UPSTREAM_HOST="${APP_UPSTREAM_HOST:-127.0.0.1}"
UPSTREAM_PORT="${APP_PORT:-1202}"
IPV6="${NGINX_IPV6:-true}"
TLS_PORT="${NGINX_TLS_PORT:-}"
SSL_CERT="${NGINX_SSL_CERT:-}"
SSL_KEY="${NGINX_SSL_KEY:-}"
BODY_SIZE="${NGINX_CLIENT_MAX_BODY_SIZE:-10m}"
PROXY_TIMEOUT="${NGINX_PROXY_TIMEOUT:-60s}"

if [ "$UPSTREAM_PORT" = "$PUBLIC_PORT" ]; then
  echo "APP_PORT ($UPSTREAM_PORT) must differ from NGINX_PUBLIC_PORT ($PUBLIC_PORT):" \
       "nginx owns the public port and proxies to the application port." >&2
  exit 1
fi

case "$UPSTREAM_HOST" in
  127.*|::1|localhost) ;;
  *) echo "APP_UPSTREAM_HOST is '$UPSTREAM_HOST' — the application must bind loopback" \
          "so nginx stays its only public listener." >&2; exit 1 ;;
esac

# default_server only when this block owns the port outright. A named vhost may
# legitimately share the port with another, and two default_server blocks on one
# address stop nginx from loading at all.
default_flag=""
[ "$SERVER_NAME" = "_" ] && default_flag=" default_server"

build_listen() {
  local port="$1" extra="$2" lines=""
  if [ -n "$LISTEN_ADDRESS" ]; then
    lines="    listen ${LISTEN_ADDRESS}:${port}${default_flag}${extra};"
  else
    lines="    listen ${port}${default_flag}${extra};"
    if [ "$IPV6" = "true" ]; then
      lines="${lines}"$'\n'"    listen [::]:${port}${default_flag}${extra};"
    fi
  fi
  printf '%s' "$lines"
}

LISTEN_DIRECTIVES="$(build_listen "$PUBLIC_PORT" "")"
SSL_DIRECTIVES=""

if [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ]; then
  if [ -z "$TLS_PORT" ]; then
    echo "NGINX_SSL_CERT is set but NGINX_TLS_PORT is not: the TLS listener has no port." >&2
    exit 1
  fi
  LISTEN_DIRECTIVES="${LISTEN_DIRECTIVES}"$'\n'"$(build_listen "$TLS_PORT" " ssl")"
  SSL_DIRECTIVES=$'\n'"    ssl_certificate ${SSL_CERT};"$'\n'"    ssl_certificate_key ${SSL_KEY};"
fi

content="$(cat "$SRC")"
content="${content//__LISTEN_DIRECTIVES__/$LISTEN_DIRECTIVES}"
content="${content//__SSL_DIRECTIVES__/$SSL_DIRECTIVES}"
content="${content//__SERVER_NAME__/$SERVER_NAME}"
content="${content//__UPSTREAM_HOST__/$UPSTREAM_HOST}"
content="${content//__UPSTREAM_PORT__/$UPSTREAM_PORT}"
content="${content//__CLIENT_MAX_BODY_SIZE__/$BODY_SIZE}"
content="${content//__PROXY_TIMEOUT__/$PROXY_TIMEOUT}"

if [ "$PRINT_ONLY" -eq 1 ]; then
  printf '%s\n' "$content"
  exit 0
fi

[ "$(id -u)" -eq 0 ] || { echo "installing $DEST requires root: run with sudo" >&2; exit 1; }
command -v nginx >/dev/null 2>&1 || { echo "nginx is not installed" >&2; exit 1; }

# Another site must not already hold the public port with its own default_server.
taken="$(grep -lE "^[[:space:]]*listen[[:space:]]+([^;]*:)?${PUBLIC_PORT}\b" \
  /etc/nginx/conf.d/*.conf /etc/nginx/sites-enabled/* 2>/dev/null |
  grep -vFx "$DEST" || true)"
if [ -n "$taken" ]; then
  echo "port ${PUBLIC_PORT} is already claimed by:" >&2
  printf '  %s\n' $taken >&2
  echo "set NGINX_PUBLIC_PORT in $ENV_FILE, or remove that config." >&2
  exit 1
fi

backup=""
if [ -f "$DEST" ]; then
  backup="$(mktemp)"
  cp "$DEST" "$backup"
fi

rendered="$(mktemp)"
printf '%s\n' "$content" > "$rendered"
install -m 644 -o root -g root "$rendered" "$DEST"
rm -f "$rendered"

if ! nginx -t; then
  if [ -n "$backup" ]; then
    install -m 644 -o root -g root "$backup" "$DEST"
    rm -f "$backup"
    echo "nginx rejected the generated config; the previous one was restored." >&2
  else
    rm -f "$DEST"
    echo "nginx rejected the generated config; it was not installed." >&2
  fi
  exit 1
fi

[ -n "$backup" ] && rm -f "$backup"

if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx || systemctl restart nginx
else
  nginx -s reload
fi

listen_label="${LISTEN_ADDRESS:-0.0.0.0}:${PUBLIC_PORT}"
[ -n "$SSL_DIRECTIVES" ] && listen_label="${listen_label} + ${LISTEN_ADDRESS:-0.0.0.0}:${TLS_PORT} (TLS)"
echo "rendered ${DEST}; nginx serving ${listen_label} → ${UPSTREAM_HOST}:${UPSTREAM_PORT}"
