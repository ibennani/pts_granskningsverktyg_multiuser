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
# Deploy startar automatiskt: granskningsverktyget-v2 (backend) + granskningsverktyget-watchdog (health-check var minut)
```

**Viktigt – så att appen startar efter serveromstart:**

1. Efter första deploy (eller när processerna är igång): kör `pm2 save` så att nuvarande processlista sparas.
2. Kör `pm2 startup` och följ kommandot det skriver ut (vanligtvis ett `sudo env ...`-kommando). Då startar PM2 + appen automatiskt vid varje reboot.

```bash
pm2 save
pm2 startup
# Kör det kommando som pm2 startup visar (t.ex. sudo env PATH=... PM2_HOME=... pm2 startup systemd -u USER --hp /home/USER)
```

## 6. Loggrotation (PM2)

Så att PM2-loggar inte fyller disken över tid:

```bash
pm2 install pm2-logrotate
# Standard: rotera när logg når 10M, behåll 30 rotationer. Ändra vid behov:
# pm2 set pm2-logrotate:max_size 10M
# pm2 set pm2-logrotate:retain 30
```

## 7. Deploy

Efter detta kan du köra `npm run deploy:v2` från din lokala maskin.

Se `docs/deploy-v2-workflow.md` för daglig deploy-workflow och `docs/drift-checklista.md` för drift och incidenthantering.
