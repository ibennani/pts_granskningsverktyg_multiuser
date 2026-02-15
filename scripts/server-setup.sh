#!/bin/bash
# Server-setup för Granskningsverktyget
# Kör med: sudo bash server-setup.sh
# RHEL 9 / Red Hat Enterprise Linux

set -e

echo "=== 1. Installerar Podman (Docker-kompatibel på RHEL) ==="
dnf install -y podman podman-docker
systemctl enable podman
systemctl start podman

# Skapa alias så docker-kommandon fungerar
ln -sf /usr/bin/podman /usr/local/bin/docker 2>/dev/null || true

echo "=== 2. Installerar Podman Compose ==="
dnf install -y podman-compose 2>/dev/null || pip3 install podman-compose 2>/dev/null || true

echo "=== 3. Uppgraderar Node.js till 20.x ==="
dnf module reset nodejs -y 2>/dev/null || true
curl -fsSL https://rpm.nodesource.com/setup_20.x -o /tmp/nodesource-setup.sh
bash /tmp/nodesource-setup.sh
dnf install -y nodejs
rm -f /tmp/nodesource-setup.sh

echo "=== 4. Verifierar installation ==="
podman --version
node --version
npm --version

echo ""
echo "=== Klart! ==="
