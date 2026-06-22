#!/bin/bash
# Kontrollerar om backend svarar. Om inte – startar om PM2.
# Körs t.ex. via cron var 5:e minut: */5 * * * * /var/www/granskningsverktyget-v2/scripts/health-check-and-restart.sh
#
# Sätt upp cron: npm run deploy:setup-cron
# Eller manuellt: crontab -e och lägg till raden som deploy:setup-cron visar

set -e

DIR="${0%/*}"
cd "$DIR/.." || exit 1

RESP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:3000/api/health 2>/dev/null || echo "000")

if [ "$RESP" = "200" ]; then
    exit 0
fi

# Försök först säkerställa att Postgres är igång (vanligaste orsaken till att backend inte svarar).
# Använd fast docker compose-projektnamn så att rätt volym används.
PROJECT_DIR="/var/www/granskningsverktyget-v2"
DOCKER_PROJECT="granskningsverktyget-v2"
DB_CONTAINER="granskningsverktyget-db"

if ! docker exec "$DB_CONTAINER" pg_isready -U granskning >/dev/null 2>&1; then
    echo "$(date -Iseconds) Postgres verkar nere – försöker starta (endast postgres)"
    (cd "$PROJECT_DIR" && docker compose -p "$DOCKER_PROJECT" up -d postgres) || true
fi

# Backend svarar inte – starta om
echo "$(date -Iseconds) Backend svarade inte (HTTP $RESP) – startar om PM2"
(npx pm2 restart granskningsverktyget-v2 2>/dev/null || pm2 restart granskningsverktyget-v2 2>/dev/null) || true
