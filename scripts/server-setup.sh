#!/bin/bash
# Server-setup för Granskningsverktyget
# Kör med: sudo bash server-setup.sh
# RHEL 9 / Red Hat Enterprise Linux

set -e

echo "=== 1. Installerar Docker ==="
dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
usermod -aG docker localiliben 2>/dev/null || true

echo "=== 2. Uppgraderar Node.js till 20.x ==="
dnf module reset nodejs -y 2>/dev/null || true
curl -fsSL https://rpm.nodesource.com/setup_20.x -o /tmp/nodesource-setup.sh
bash /tmp/nodesource-setup.sh
dnf install -y nodejs
rm -f /tmp/nodesource-setup.sh

echo "=== 3. Verifierar installation ==="
docker --version
docker compose version
node --version
npm --version

echo ""
echo "=== Klart! ==="
