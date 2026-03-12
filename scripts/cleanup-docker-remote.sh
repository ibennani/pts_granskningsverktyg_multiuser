#!/bin/bash
# Docker-städning på servern. Tar bort stoppade containrar, oanvända nätverk
# och hängande images. RÖR INTE datavolymer (t.ex. granskningsverktyget-v2_pgdata).
#
# Kör manuellt: ./scripts/cleanup-docker-remote.sh
# Cron (t.ex. söndag 04:00): 0 4 * * 0 /var/www/granskningsverktyget-v2/scripts/cleanup-docker-remote.sh >> /var/log/gv-docker-cleanup.log 2>&1

set -e
echo "[$(date -Iseconds)] Docker-städning startar."
docker system prune -f
echo "[$(date -Iseconds)] Docker-städning klar."
