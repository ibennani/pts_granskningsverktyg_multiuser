#!/bin/bash
# Backup-drift: körs var 5:e minut via cron (npm run setup:cron).
# Kompletterar watchdog (var 45:e sekund) om processer saknas, hänger eller watchdog tystnat.
#
# Sätt upp: npm run setup:cron  eller  npm run setup:drift

set +e

DIR="${0%/*}"
cd "$DIR/.." || exit 1

# shellcheck source=pm2-leffe-common.sh
. "$DIR/pm2-leffe-common.sh"

CHANGED=0

leffe_ensure_postgres

if leffe_ensure_watchdog; then
    :
else
    CHANGED=1
fi

if leffe_restart_or_start_backend "v2-backend" "3000" "$LEFFE_V2_APP" "$GV_SERVER_DIR"; then
    :
else
    CHANGED=1
fi

if [ -d "$GV_TEST_SERVER_DIR" ] && [ -f "$GV_TEST_SERVER_DIR/package.json" ]; then
    if leffe_restart_or_start_backend "test-server-backend" "3001" "$LEFFE_TEST_APP" "$GV_TEST_SERVER_DIR"; then
        :
    else
        CHANGED=1
    fi
fi

leffe_note_nginx_status

if [ "$CHANGED" -eq 1 ]; then
    npx pm2 save 2>/dev/null || true
fi

exit 0
