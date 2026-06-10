#!/usr/bin/env bash
# Startar Leffe-komponenter och registrerar PM2 för omstart vid serverboot.
# Körs på V2-servern (npm run setup:v2:boot eller manuellt utan sudo).
set -euo pipefail

PROJECT_DIR="${GV_SERVER_DIR:-/var/www/granskningsverktyget-v2}"
DOCKER_PROJECT="${GV_DOCKER_PROJECT:-sessionversion}"
APP_NAME="granskningsverktyget-v2"
WATCHDOG_NAME="granskningsverktyget-watchdog"
BOOT_USER="${LEFFE_BOOT_USER:-$(whoami)}"
BOOT_HOME="$(getent passwd "$BOOT_USER" 2>/dev/null | cut -d: -f6 || echo "/home/$BOOT_USER")"
PM2_SERVICE="pm2-${BOOT_USER}.service"

log() { echo "[boot-leffe] $*"; }

run_app() {
    cd "$PROJECT_DIR"
    bash -l -c "$*"
}

log "Användare: $BOOT_USER, projekt: $PROJECT_DIR"

log "Startar Postgres (Docker)..."
if docker ps --format '{{.Names}}' | grep -qx 'granskningsverktyget-db'; then
    log "Postgres-containern kör redan."
elif docker ps -a --format '{{.Names}}' | grep -qx 'granskningsverktyget-db'; then
    docker start granskningsverktyget-db
else
    cd "$PROJECT_DIR"
    docker compose -p "$DOCKER_PROJECT" up -d postgres
fi

log "Säkerställer PM2-processer..."
run_app "npx pm2 delete $APP_NAME 2>/dev/null || true"
run_app "npx pm2 start npm --name $APP_NAME -- run dev:server"
run_app "npx pm2 restart $WATCHDOG_NAME 2>/dev/null || npx pm2 start scripts/healthcheck-watchdog.js --name $WATCHDOG_NAME"
run_app "npx pm2 install pm2-logrotate 2>/dev/null || true"
run_app "npx pm2 save"

if [ "${LEFFE_SKIP_SYSTEMD:-}" != "1" ]; then
    if systemctl is-enabled "$PM2_SERVICE" 2>/dev/null | grep -q '^enabled$'; then
        log "PM2 systemd ($PM2_SERVICE) är redan enabled."
    else
        log "Registrerar PM2 startup – kör sudo-kommandot från pm2 (kräver root/sudo)..."
        STARTUP_OUT="$(run_app "npx pm2 startup systemd -u $BOOT_USER --hp $BOOT_HOME" 2>&1 || true)"
        SUDO_LINE="$(printf '%s\n' "$STARTUP_OUT" | grep -E '^sudo ' | tail -1)"
        if [ -z "$SUDO_LINE" ]; then
            log "VARNING: Kunde inte hitta sudo-rad från pm2 startup:"
            printf '%s\n' "$STARTUP_OUT"
            log "Kör: npm run setup:v2:boot med DEPLOY_SUDO_PASSWORD i .env"
            exit 1
        fi
        eval "$SUDO_LINE"
        run_app "npx pm2 save"
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

log "Väntar på /api/health..."
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS --connect-timeout 5 http://127.0.0.1:3000/api/health -o /dev/null; then
        log "Backend svarar HTTP 200."
        log "Klart."
        exit 0
    fi
    sleep 3
done

log "FEL: Backend svarade inte inom timeout."
run_app "npx pm2 logs $APP_NAME --lines 20 --nostream 2>/dev/null || true"
exit 1
