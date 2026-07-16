#!/usr/bin/env bash
# Startar Leffe-komponenter och registrerar PM2 för omstart vid serverboot.
# Körs på V2-servern (npm run setup:boot / setup:drift eller manuellt utan sudo).
set -euo pipefail

SCRIPT_DIR="${0%/*}"
# shellcheck source=pm2-leffe-common.sh
. "$SCRIPT_DIR/pm2-leffe-common.sh"

BOOT_USER="${LEFFE_BOOT_USER:-$(whoami)}"
BOOT_HOME="$(getent passwd "$BOOT_USER" 2>/dev/null | cut -d: -f6 || echo "/home/$BOOT_USER")"
PM2_SERVICE="pm2-${BOOT_USER}.service"

log() { leffe_log "[boot] $*"; }

run_in_dir() {
    local dir="$1"
    shift
    cd "$dir"
    bash -l -c "$*"
}

log "Användare: $BOOT_USER, v2: $GV_SERVER_DIR, test-server: $GV_TEST_SERVER_DIR"

log "Startar Postgres (Docker)..."
leffe_ensure_postgres

log "Säkerställer PM2-processer (v2)..."
leffe_start_backend_pm2 "$LEFFE_V2_APP" "$GV_SERVER_DIR"

if [ -d "$GV_TEST_SERVER_DIR" ] && [ -f "$GV_TEST_SERVER_DIR/package.json" ]; then
    log "Säkerställer PM2-processer (test-server)..."
    leffe_start_backend_pm2 "$LEFFE_TEST_APP" "$GV_TEST_SERVER_DIR"
else
    log "Test-server-mapp saknas ($GV_TEST_SERVER_DIR) – hoppar över test-server PM2."
fi

run_in_dir "$GV_SERVER_DIR" "npx pm2 install pm2-logrotate 2>/dev/null || true"
leffe_start_watchdog_pm2
leffe_start_drift_backup_pm2
run_in_dir "$GV_SERVER_DIR" "npx pm2 save"

if [ "${LEFFE_SKIP_SYSTEMD:-}" != "1" ]; then
    if systemctl is-enabled "$PM2_SERVICE" 2>/dev/null | grep -q '^enabled$'; then
        log "PM2 systemd ($PM2_SERVICE) är redan enabled."
    else
        log "Registrerar PM2 startup – kör sudo-kommandot från pm2 (kräver root/sudo)..."
        STARTUP_OUT="$(run_in_dir "$GV_SERVER_DIR" "npx pm2 startup systemd -u $BOOT_USER --hp $BOOT_HOME" 2>&1 || true)"
        SUDO_LINE="$(printf '%s\n' "$STARTUP_OUT" | grep -E '^sudo ' | tail -1)"
        if [ -z "$SUDO_LINE" ]; then
            log "VARNING: Kunde inte hitta sudo-rad från pm2 startup:"
            printf '%s\n' "$STARTUP_OUT"
            log "Kör: npm run setup:drift med DEPLOY_SUDO_PASSWORD i .env"
            exit 1
        fi
        eval "$SUDO_LINE"
        run_in_dir "$GV_SERVER_DIR" "npx pm2 save"
        log "PM2 startup registrerad."
    fi

    if command -v sudo >/dev/null 2>&1 && [ "$(id -u)" -ne 0 ]; then
        sudo systemctl enable nginx 2>/dev/null || true
        sudo systemctl enable docker 2>/dev/null || true
    elif [ "$(id -u)" -eq 0 ]; then
        systemctl enable nginx 2>/dev/null || true
        systemctl enable docker 2>/dev/null || true
    fi
else
    log "LEFFE_SKIP_SYSTEMD=1 – systemd-steg körs separat."
fi

wait_for_health() {
    local label="$1"
    local url="$2"
    log "Väntar på $label ($url)..."
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        if curl -fsS --connect-timeout 5 "$url" -o /dev/null; then
            log "$label svarar HTTP 200."
            return 0
        fi
        sleep 3
    done
    log "FEL: $label svarade inte inom timeout."
    return 1
}

FAILED=0
wait_for_health "v2-backend" "http://127.0.0.1:3000/api/health" || FAILED=1

if [ -d "$GV_TEST_SERVER_DIR" ] && [ -f "$GV_TEST_SERVER_DIR/package.json" ]; then
    wait_for_health "test-server-backend" "http://127.0.0.1:3001/api/health" || FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
    run_in_dir "$GV_SERVER_DIR" "npx pm2 list 2>/dev/null || true"
    run_in_dir "$GV_SERVER_DIR" "npx pm2 logs --lines 20 --nostream 2>/dev/null || true"
    exit 1
fi

log "Klart."
