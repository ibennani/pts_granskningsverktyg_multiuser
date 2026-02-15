# Första gången: Server-setup för v2

Kör dessa steg **en gång** på servern innan du använder `npm run deploy:v2`.

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

## 2. Postgres (Docker)

Om Postgres inte redan körs:

```bash
cd /var/www/granskningsverktyget-v2
# Kopiera docker-compose.yml hit eller kör från projektmappen
docker compose up -d
```

## 3. Nginx

Nginx ska ha `location /v2/` och `location /v2/api/` (se `scripts/ux-granskning-with-v2.conf`).

**Viktigt:** Deploy skickar frontend till `/var/www/granskningsverktyget-v2/v2/` (inte `dist/`).
Nginx använder `root` (inte `alias`) för att undvika kända problem med `try_files`:

```nginx
location /v2/ {
    root /var/www/granskningsverktyget-v2;
    try_files $uri $uri/ /v2/index.html;
}
```

Om du uppdaterar nginx-konfigurationen: `sudo nginx -t && sudo systemctl reload nginx`.

**Migration från dist/ till v2/:** Om du tidigare deployade till `dist/` måste nginx-konfigurationen uppdateras (byta `alias` mot `root` som ovan) och en ny deploy körs. Den gamla `dist/`-mappen tas bort vid nästa deploy.

## 4. SELinux (RHEL/CentOS)

Om nginx får 502 vid API-anrop:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

## 5. PM2 (Node process manager)

För att backend ska starta om vid deploy och överleva serveromstart:

```bash
npm install -g pm2
# Efter första deploy: pm2 start server/index.js --name granskningsverktyget-v2
# pm2 save && pm2 startup  # för att starta vid omstart
```

## 6. Deploy

Efter detta kan du köra `npm run deploy:v2` från din lokala maskin.

Se `docs/deploy-v2-workflow.md` för daglig deploy-workflow.
