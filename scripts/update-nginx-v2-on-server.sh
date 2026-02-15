#!/bin/bash
# Kör på servern med sudo. Tar CONFIG_FIL som argument eller använder /tmp/ux-granskning-with-v2.conf.
#
# Användning (från projektmappen):
#   scp scripts/ux-granskning-with-v2.conf granskning:/tmp/
#   scp scripts/update-nginx-v2-on-server.sh granskning:/tmp/
#   ssh granskning 'sudo bash /tmp/update-nginx-v2-on-server.sh'

set -e

CONF="/etc/nginx/conf.d/ux-granskning.conf"
SOURCE="${1:-/tmp/ux-granskning-with-v2.conf}"

if [ -f "$SOURCE" ]; then
    cp "$CONF" "${CONF}.bak"
    cp "$SOURCE" "$CONF"
    echo "Kopierade config från $SOURCE"
else
    # Fallback: ersätt alias med root
    if grep -q "alias /var/www/granskningsverktyget-v2/dist/" "$CONF"; then
        cp "$CONF" "${CONF}.bak"
        sed -i 's|alias /var/www/granskningsverktyget-v2/dist/;|root /var/www/granskningsverktyget-v2;|' "$CONF"
        echo "Uppdaterade location /v2/ till root"
    else
        echo "Config verkar redan uppdaterad."
    fi
fi

nginx -t && systemctl reload nginx
echo "Nginx omstartad."
