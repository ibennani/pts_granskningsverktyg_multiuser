#!/usr/bin/env bash
# Gemensamma PM2-hjälpare för boot och cron på servern.
# Sourcas: . scripts/pm2-leffe-common.sh

GV_SERVER_DIR="${GV_SERVER_DIR:-/var/www/granskningsverktyget-v2}"
GV_TEST_SERVER_DIR="${GV_TEST_SERVER_DIR:-/var/www/granskningsverktyget-test-server}"
GV_DOCKER_PROJECT="${GV_DOCKER_PROJECT:-granskningsverktyget-v2}"
GV_DB_CONTAINER="${GV_DB_CONTAINER:-granskningsverktyget-db}"

LEFFE_V2_APP="granskningsverktyget-v2"
LEFFE_TEST_APP="granskningsverktyget-test-server"
LEFFE_WATCHDOG_APP="granskningsverktyget-watchdog"
LEFFE_DRIFT_BACKUP_APP="granskningsverktyget-drift-backup"
LEFFE_BACKEND_PM2_OPTS="--max-memory-restart 600M --exp-backoff-restart-delay 200"
LEFFE_WATCHDOG_PM2_OPTS="--max-memory-restart 150M --exp-backoff-restart-delay 200"
LEFFE_WATCHDOG_HEARTBEAT="${GV_SERVER_DIR}/logs/watchdog.heartbeat"
LEFFE_WATCHDOG_MAX_AGE_SEC="${LEFFE_WATCHDOG_MAX_AGE_SEC:-150}"

leffe_log() {
    echo "[leffe-drift] $*"
}

leffe_ensure_postgres() {
    if docker exec "$GV_DB_CONTAINER" pg_isready -U granskning >/dev/null 2>&1; then
        return 0
    fi
    leffe_log "Postgres verkar nere – försöker starta containern"
    (cd "$GV_SERVER_DIR" && docker compose -p "$GV_DOCKER_PROJECT" up -d postgres) || true
}

leffe_start_backend_pm2() {
    local name="$1"
    local dir="$2"
    npx pm2 delete "$name" 2>/dev/null || true
    npx pm2 start npm --name "$name" --cwd "$dir" $LEFFE_BACKEND_PM2_OPTS -- run dev:server
}

leffe_start_watchdog_pm2() {
    (cd "$GV_SERVER_DIR" && npx pm2 delete "$LEFFE_WATCHDOG_APP" 2>/dev/null || true)
    (cd "$GV_SERVER_DIR" && npx pm2 start scripts/healthcheck-watchdog.js --name "$LEFFE_WATCHDOG_APP" $LEFFE_WATCHDOG_PM2_OPTS)
}

leffe_start_drift_backup_pm2() {
    (cd "$GV_SERVER_DIR" && npx pm2 delete "$LEFFE_DRIFT_BACKUP_APP" 2>/dev/null || true)
    (cd "$GV_SERVER_DIR" && npx pm2 start scripts/drift-backup-loop.js --name "$LEFFE_DRIFT_BACKUP_APP" --max-memory-restart 100M)
}

leffe_pm2_process_online() {
    local name="$1"
    npx pm2 describe "$name" 2>/dev/null | grep -q 'status.*online'
}

leffe_health_http_code() {
    local port="$1"
    curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://127.0.0.1:${port}/api/health" 2>/dev/null || echo "000"
}

leffe_restart_or_start_backend() {
    local label="$1"
    local port="$2"
    local name="$3"
    local dir="$4"

    if [ "$(leffe_health_http_code "$port")" = "200" ]; then
        return 0
    fi

    leffe_log "$label svarar inte – startar om $name"
    if leffe_pm2_process_online "$name"; then
        npx pm2 restart "$name" 2>/dev/null || true
    else
        leffe_start_backend_pm2 "$name" "$dir"
    fi
    return 1
}

leffe_ensure_watchdog() {
    mkdir -p "${GV_SERVER_DIR}/logs"

    if ! npx pm2 describe "$LEFFE_WATCHDOG_APP" >/dev/null 2>&1; then
        leffe_log "Watchdog saknas i PM2 – startar"
        leffe_start_watchdog_pm2
        return 1
    fi

    if [ ! -f "$LEFFE_WATCHDOG_HEARTBEAT" ]; then
        leffe_log "Watchdog heartbeat saknas – startar om watchdog"
        npx pm2 restart "$LEFFE_WATCHDOG_APP" 2>/dev/null || leffe_start_watchdog_pm2
        return 1
    fi

    local now age mtime
    now=$(date +%s)
    mtime=$(stat -c %Y "$LEFFE_WATCHDOG_HEARTBEAT" 2>/dev/null || echo 0)
    age=$((now - mtime))
    if [ "$age" -gt "$LEFFE_WATCHDOG_MAX_AGE_SEC" ]; then
        leffe_log "Watchdog heartbeat är ${age}s gammal – startar om watchdog"
        npx pm2 restart "$LEFFE_WATCHDOG_APP" 2>/dev/null || leffe_start_watchdog_pm2
        return 1
    fi

    return 0
}

leffe_note_nginx_status() {
    if command -v systemctl >/dev/null 2>&1; then
        if ! systemctl is-active nginx >/dev/null 2>&1; then
            leffe_log "VARNING: nginx är inte active (kräver sudo för omstart på servern)"
        fi
    fi
}
