#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_SCRIPT="$ROOT_DIR/server.sh"
DATA_CHECK_SCRIPT="$ROOT_DIR/scripts/check-data-integrity.js"
# Canonical Sphinx configuration (consolidated)
SPHINX_CONFIG="${SPHINX_CONFIG:-$ROOT_DIR/config/sphinx-unified.conf}"
SPHINX_PID_FILE="$ROOT_DIR/logs/sphinx.pid"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

err() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

require_command() {
  if ! command -v "$1" &>/dev/null; then
    err "Required command '$1' not found in PATH"
    exit 1
  fi
}

cmd_deploy() {
  log "Starting deploy sequence"

  if [ ! -x "$SERVER_SCRIPT" ]; then
    err "server.sh not executable or missing"
    exit 1
  fi

  log "Stopping existing server (if running)"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 stop ethnos-api || true
  else
    "$SERVER_SCRIPT" stop || true
  fi

  log "Clearing caches"
  "$SERVER_SCRIPT" clear-cache || true

  log "Installing dependencies"
  npm install --no-fund

  log "Generating documentation cache"
  npm run docs:generate >/dev/null 2>&1 || warn "Swagger generation failed; continuing"

  log "Rebuilding Sphinx indexes"
  cmd_index

  log "Running full endpoint test suite"
  npm run test

  log "Restarting server"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart ethnos-api --update-env || pm2 start "$ROOT_DIR/ecosystem.config.js" --env production
    pm2 save || true
  else
    "$SERVER_SCRIPT" restart
  fi

  log "Deploy completed"
}

cmd_start() {
  if command -v pm2 >/dev/null 2>&1; then
    log "Starting via PM2 (production)"
    pm2 start "$ROOT_DIR/ecosystem.config.js" --env production
    pm2 save || true
  else
    "$SERVER_SCRIPT" start
  fi
}

cmd_stop() {
  if command -v pm2 >/dev/null 2>&1; then
    log "Stopping via PM2"
    pm2 stop ethnos-api || true
    pm2 save || true
  else
    "$SERVER_SCRIPT" stop
  fi
}

cmd_restart() {
  if command -v pm2 >/dev/null 2>&1; then
    log "Restarting via PM2 (update env)"
    pm2 restart ethnos-api --update-env || pm2 start "$ROOT_DIR/ecosystem.config.js" --env production
    pm2 save || true
  else
    "$SERVER_SCRIPT" restart
  fi
}

cmd_index() {
  require_command indexer
  if [ ! -f "$SPHINX_CONFIG" ]; then
    err "Sphinx configuration not found at $SPHINX_CONFIG"
    exit 1
  fi

  log "Running Sphinx indexer"
  indexer --config "$SPHINX_CONFIG" --rotate --all
  log "Sphinx indexes rebuilt"
}

cmd_index_fast() {
  require_command indexer
  if [ ! -f "$SPHINX_CONFIG" ]; then
    err "Sphinx configuration not found at $SPHINX_CONFIG"
    exit 1
  fi
  log "Running Sphinx indexer (fast)"
  indexer --config "$SPHINX_CONFIG" --rotate works_poc persons_poc venues_metrics_poc || {
    warn "Fast index failed; falling back to --all";
    indexer --config "$SPHINX_CONFIG" --rotate --all;
  }
  log "Sphinx fast indexes rebuilt"
}

cmd_sphinx_start() {
  require_command searchd
  mkdir -p "$ROOT_DIR/logs"
  sudo mkdir -p /var/lib/sphinx || true
  
  if [ -f "$SPHINX_PID_FILE" ] && ps -p "$(cat "$SPHINX_PID_FILE" 2>/dev/null)" >/dev/null 2>&1; then
    warn "searchd already running (PID: $(cat "$SPHINX_PID_FILE"))"
    return 0
  fi
  log "Starting searchd with $SPHINX_CONFIG"
  searchd --config "$SPHINX_CONFIG" || {
    err "Failed to start searchd"; return 1;
  }
  sleep 1
  if [ -f "$SPHINX_PID_FILE" ]; then
    log "searchd started (PID: $(cat "$SPHINX_PID_FILE"))"
  else
    warn "PID file not found; verifying process via ports"
    ss -lnt | grep -E '(:9306|:9312)'
  fi
}

cmd_sphinx_stop() {
  require_command searchd
  if [ -f "$SPHINX_PID_FILE" ]; then
    log "Stopping searchd (PID: $(cat "$SPHINX_PID_FILE"))"
  else
    warn "PID file not found; attempting graceful stop"
  fi
  searchd --config "$SPHINX_CONFIG" --stop || true
  sleep 1
  if [ -f "$SPHINX_PID_FILE" ]; then
    local pid=$(cat "$SPHINX_PID_FILE")
    if ps -p "$pid" >/dev/null 2>&1; then
      warn "Force killing searchd (PID: $pid)"
      kill -9 "$pid" || true
    fi
    rm -f "$SPHINX_PID_FILE"
  fi
  log "searchd stopped"
}

cmd_sphinx_status() {
  if [ -f "$SPHINX_PID_FILE" ] && ps -p "$(cat "$SPHINX_PID_FILE")" >/dev/null 2>&1; then
    log "searchd running (PID: $(cat "$SPHINX_PID_FILE"))"
  else
    warn "searchd not running"
  fi
  ss -lnt | awk 'NR==1 || /9306|9312/' || true
}

cmd_test_endpoints() {
  log "Executing endpoint regression suite"
  npm run test
}

cmd_test_data() {
  require_command node
  if [ ! -f "$DATA_CHECK_SCRIPT" ]; then
    err "Data integrity script missing at $DATA_CHECK_SCRIPT"
    exit 1
  fi

  log "Validating database structures"
  node "$DATA_CHECK_SCRIPT"
}

usage() {
  cat <<USAGE
Ethnos unified control script

Usage: $(basename "$0") <command> [options]

Commands:
  deploy                 Stop, clear caches, reinstall deps, reindex Sphinx, test, and restart
  start                  Start the API server
  stop                   Stop the API server
  restart                Restart the API server
  index                  Rebuild Sphinx indexes (requires indexer)
  index:fast             Rebuild only works/persons/venues indexes
  sphinx start|stop|status  Manage searchd lifecycle
  test --endpoints       Run Jest endpoint suite
  test --data            Validate required tables, views, and indexes in the database

Examples:
  $(basename "$0") deploy
  $(basename "$0") test --endpoints
  $(basename "$0") test --data
USAGE
}

main() {
  local cmd=${1:-}
  shift || true

  case "$cmd" in
    deploy)
      cmd_deploy
      ;;
    start)
      cmd_start
      ;;
    stop)
      cmd_stop
      ;;
    restart)
      cmd_restart
      ;;
    index)
      cmd_index
      ;;
    index:fast)
      cmd_index_fast
      ;;
    sphinx)
      case "${1:-}" in
        start) cmd_sphinx_start ;;
        stop) cmd_sphinx_stop ;;
        status) cmd_sphinx_status ;;
        *) usage; exit 1 ;;
      esac
      ;;
    test)
      case "${1:-}" in
        --endpoints)
          cmd_test_endpoints
          ;;
        --data)
          cmd_test_data
          ;;
        *)
          usage
          exit 1
          ;;
      esac
      ;;
    help|--help|-h|'')
      usage
      ;;
    *)
      err "Unknown command: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"
