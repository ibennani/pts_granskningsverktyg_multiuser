# Första gången: Server-setup för v2 (Leffe)

Kör dessa steg **en gång** på servern innan du använder `npm run deploy:v2`.

**Leffe** är webbapplikationen; sökvägar som `granskningsverktyget-v2` på servern är **deploy-mappar och processnamn**, inte produktnamnet.

**Förutsättning:** SSH konfigurerat (t.ex. Host `granskning` i `~/.ssh/config`).

## 1. Skapa mapp och .env

```bash
ssh granskning  # eller ditt SSH-host

sudo mkdir -p /var/www/granskningsverktyget-v2
sudo chown $USER:$USER /var/www/granskningsverktyget-v2

cd /var/www/granskningsverktyget-v2
echo 'DATABASE_URL=postgresql://granskning:granskning@localhost:5432/granskningsverktyget' > .env
echo 'API_PORT=3000' >> .env
```

(`granskningsverktyget` i URL:en är databasnamnet i Postgres.)

## 2. Postgres (Docker)

Om Postgres inte redan körs:

```bash
cd /var/www/granskningsverktyget-v2
docker compose up -d
```

`docker-compose.yml` i repot sätter projektnamn `sessionversion` och containern `granskningsverktyget-db`.

## 3. Nginx

Använd **`scripts/ux-granskning-with-v2.conf`** som källa för korrekt ordning: `/v2/api` före `/v2/`, WebSocket `/v2/ws`, m.m.

**Deploy lägger den byggda frontenden i deploy-root** `/var/www/granskningsverktyget-v2/` (inte i en undermapp som heter `v2`). Nginx mappar URL-prefix `/v2/` till filer på den vägen med `alias` – se den faktiska konfigurationsfilen i repot.

Om du uppdaterar nginx: `sudo nginx -t && sudo systemctl reload nginx`.

## 4. SELinux (RHEL/CentOS)

Om nginx får 502 vid API-anrop:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

## 5. PM2 (Node process manager)

```bash
npm install -g pm2
```

Vid `npm run deploy:v2` startas om: `granskningsverktyget-v2` (backend) och `granskningsverktyget-watchdog` (health-check).

**Så att Leffe startar efter serveromstart (rekommenderat):**

Från utvecklingsmaskinen (kräver `DEPLOY_SSH_PASSWORD` och `DEPLOY_SUDO_PASSWORD` i `.env`):

```bash
npm run setup:v2:boot
```

Det startar Postgres, backend och watchdog, sparar PM2-listan och registrerar `pm2-<användare>.service` i systemd. nginx och Docker enable:as om sudo finns.

Manuellt på servern: `sudo bash /var/www/granskningsverktyget-v2/scripts/server-boot-leffe.sh`

Alternativ (endast PM2): `pm2 save` och `pm2 startup` (kör sudo-kommandot som visas).

## 6. Loggrotation (PM2)

```bash
pm2 install pm2-logrotate
```

## 7. Deploy

Därefter: `npm run deploy:v2` från lokal utvecklingsmaskin.

Se `docs/deploy-v2-workflow.md` och `docs/drift-checklista.md`.
