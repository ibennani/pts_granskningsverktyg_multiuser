#!/bin/bash
# Kör detta på servern efter deploy: sudo ./scripts/reload-nginx-on-server.sh
# Eller: ssh granskning 'bash -s' < scripts/reload-nginx-on-server.sh
set -e
sudo nginx -t && sudo systemctl reload nginx
echo "Nginx omstartad."
