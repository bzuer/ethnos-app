#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/next-frontend.env}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$REPO_ROOT/config/nginx.conf"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
elif [ "${1:-}" != "--print" ]; then
  echo "missing env file: $ENV_FILE" >&2
  exit 1
fi

DEST="${NGINX_APP_CONF:-/etc/nginx/conf.d/ethnos-app.conf}"
PUBLIC_PORT="${NGINX_PUBLIC_PORT:-1212}"
LISTEN_ADDRESS="${NGINX_LISTEN_ADDRESS-127.0.0.1}"
SERVER_NAME="${NGINX_SERVER_NAME:-_}"
UPSTREAM_HOST="${APP_UPSTREAM_HOST:-127.0.0.1}"
UPSTREAM_PORT="${APP_PORT:-1202}"
if [ -z "${NGINX_IPV6:-}" ]; then
  ip -6 addr show lo 2>/dev/null | grep -q inet6 && IPV6=true || IPV6=false
else
  IPV6="$NGINX_IPV6"
fi
TLS_PORT="${NGINX_TLS_PORT:-}"
SSL_CERT="${NGINX_SSL_CERT:-}"
SSL_KEY="${NGINX_SSL_KEY:-}"
BODY_SIZE="${NGINX_CLIENT_MAX_BODY_SIZE:-10m}"
PROXY_TIMEOUT="${NGINX_PROXY_TIMEOUT:-60s}"

[ "$UPSTREAM_PORT" != "$PUBLIC_PORT" ] || { echo "APP_PORT must differ from NGINX_PUBLIC_PORT" >&2; exit 1; }
case "$UPSTREAM_HOST" in
  127.*|::1|localhost) ;;
  *) echo "APP_UPSTREAM_HOST must be a loopback address" >&2; exit 1 ;;
esac

default_flag=""
[ "$SERVER_NAME" = "_" ] && default_flag=" default_server"

listen_lines() {
  local port="$1" extra="$2"
  if [ -n "$LISTEN_ADDRESS" ]; then
    printf '    listen %s:%s%s%s;' "$LISTEN_ADDRESS" "$port" "$default_flag" "$extra"
    case "$IPV6:$LISTEN_ADDRESS" in
      true:127.*) printf '\n    listen [::1]:%s%s%s;' "$port" "$default_flag" "$extra" ;;
    esac
  else
    printf '    listen %s%s%s;' "$port" "$default_flag" "$extra"
    [ "$IPV6" = "true" ] && printf '\n    listen [::]:%s%s%s;' "$port" "$default_flag" "$extra"
  fi
  return 0
}

LISTEN_DIRECTIVES="$(listen_lines "$PUBLIC_PORT" "")"
SSL_DIRECTIVES=""
if [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ]; then
  [ -n "$TLS_PORT" ] || { echo "NGINX_SSL_CERT requires NGINX_TLS_PORT" >&2; exit 1; }
  LISTEN_DIRECTIVES="$LISTEN_DIRECTIVES"$'\n'"$(listen_lines "$TLS_PORT" " ssl")"
  SSL_DIRECTIVES=$'\n'"    ssl_certificate $SSL_CERT;"$'\n'"    ssl_certificate_key $SSL_KEY;"
fi

content="$(cat "$SRC")"
content="${content//__LISTEN_DIRECTIVES__/$LISTEN_DIRECTIVES}"
content="${content//__SSL_DIRECTIVES__/$SSL_DIRECTIVES}"
content="${content//__SERVER_NAME__/$SERVER_NAME}"
content="${content//__UPSTREAM_HOST__/$UPSTREAM_HOST}"
content="${content//__UPSTREAM_PORT__/$UPSTREAM_PORT}"
content="${content//__CLIENT_MAX_BODY_SIZE__/$BODY_SIZE}"
content="${content//__PROXY_TIMEOUT__/$PROXY_TIMEOUT}"

if [ "${1:-}" = "--print" ]; then
  printf '%s\n' "$content"
  exit 0
fi

[ "$(id -u)" -eq 0 ] || { echo "installing $DEST requires root" >&2; exit 1; }

backup="$(mktemp)"
[ -f "$DEST" ] && cp "$DEST" "$backup" || : > "$backup"
rendered="$(mktemp)"
printf '%s\n' "$content" > "$rendered"
install -m 644 -o root -g root "$rendered" "$DEST"
rm -f "$rendered"
if ! nginx -t 2>/dev/null; then
  if [ -s "$backup" ]; then install -m 644 -o root -g root "$backup" "$DEST"; else rm -f "$DEST"; fi
  rm -f "$backup"
  nginx -t
  echo "nginx rejected the rendered config; the previous one was kept" >&2
  exit 1
fi
rm -f "$backup"
systemctl reload nginx
echo "installed $DEST ($PUBLIC_PORT → $UPSTREAM_HOST:$UPSTREAM_PORT)"
