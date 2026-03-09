# Deploy-workflow: Lokala ändringar → Servern

När du ändrat frontend eller backend och vill att servern ska fungera som lokalt:

## Snabbversion

```bash
npm run deploy:v2
```

Detta bygger, laddar upp och startar om allt på servern.

## Automatisk SSH-inloggning

För att bara behöva skriva `npm run deploy:v2` utan lösenordsfråga:

1. Lägg till i din lokala `.env` (filen är gitignorerad):
   ```
   DEPLOY_SSH_PASSWORD=ditt_ssh_lösenord
   ```
   Om ditt SSH-användarnamn skiljer sig från Windows-användarnamnet:
   ```
   DEPLOY_USER=användarnamn
   ```

2. Därefter körs `npm run deploy:v2`, `deploy:debug` och `deploy:fix-env` utan lösenordsfråga. Fungerar på Windows, Linux och Mac (använder node-ssh).

**Alternativ: SSH-nycklar (ingen lösenordsfil):**
```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519_granskning
ssh-copy-id -i ~/.ssh/id_ed25519_granskning.pub ux-granskningsverktyg.pts.ad
# Lägg till i ~/.ssh/config: Host ux-granskningsverktyg.pts.ad IdentityFile ~/.ssh/id_ed25519_granskning
```

## Produktions-URL och CORS (.env – sparas inte i Git)

För att CORS och andra inställningar ska använda din publika adress (t.ex. `https://ux-granskningsverktyg.pts.ad`) utan att URL:en sparas i GitHub:

1. **Lägg variablerna i `.env`** (filen är redan i `.gitignore` och kopieras till servern vid deploy, men commitas aldrig):
   ```
   PUBLIC_APP_URL=https://ux-granskningsverktyg.pts.ad
   ```
   Backend använder då `PUBLIC_APP_URL` som tillåten origin för CORS om `ALLOWED_ORIGINS` inte är satt.

2. **Flera origins (t.ex. dev + prod):** sätt i stället:
   ```
   ALLOWED_ORIGINS=https://ux-granskningsverktyg.pts.ad,http://localhost:5173
   ```

Vid `npm run deploy:v2` kopieras `.env` till servern (utom rader som börjar med `DEPLOY_`), så samma URL gäller både lokalt och på servern utan att något av detta hamnar i Git.

## Vad deploy gör

| Komponent | Vad som händer |
|----------|----------------|
| **Frontend** | `vite build` → dist/ → laddas upp till serverns `v2/` |
| **Backend** | `server/` laddas upp, `npm install`, `pm2 restart` |
| **Databas** | `npm run db:migrate` körs (nya migrationer appliceras) |
| **Behörigheter** | `chmod -R o+rX v2/` så att nginx kan läsa filerna |

## Krav på servern (en gång)

- **Docker + Postgres** – `docker compose up -d` i projektmappen
- **PM2** – `npm install -g pm2` (för att backend ska starta om vid deploy)
- **SELinux** – `sudo setsebool -P httpd_can_network_connect 1` (om inte redan gjort)
- **Nginx** – Konfigurerad enligt `scripts/ux-granskning-with-v2.conf`

## Automatisk omstart vid nere-server

En watchdog-process kontrollerar var minut om backend svarar. Om inte – startas PM2 om automatiskt.

**Startas automatiskt vid `npm run deploy:v2`** – ingen manuell konfiguration behövs. Watchdog körs som PM2-process (`granskningsverktyget-watchdog`).

Shell-scriptet `scripts/health-check-and-restart.sh` finns kvar för manuell körning eller cron-fallback.

## Om deploy misslyckas på Windows

SSH-kommandot med `&&` kan ge "The syntax of the command is incorrect". Kör då stegen manuellt:

```bash
# 1. Bygg lokalt
npm run build

# 2. Kopiera till servern
scp -r dist granskning:/var/www/granskningsverktyget-v2/temp-dist
ssh granskning "rm -rf /var/www/granskningsverktyget-v2/v2 && mkdir -p /var/www/granskningsverktyget-v2/v2 && cp -r /var/www/granskningsverktyget-v2/temp-dist/* /var/www/granskningsverktyget-v2/v2/ && chmod -R o+rX /var/www/granskningsverktyget-v2/v2 && rm -rf /var/www/granskningsverktyget-v2/temp-dist"

# 3. Backend
scp -r server docker-compose.yml package.json package-lock.json granskning:/var/www/granskningsverktyget-v2/
ssh granskning "cd /var/www/granskningsverktyget-v2 && npm install --omit=dev --ignore-scripts && npm run db:migrate && pm2 restart granskningsverktyget-v2"
```

## Nya databasmigrationer

Om du lägger till filer i `server/migrations/`:

- De körs automatiskt vid `npm run deploy:v2` (via `db:migrate`)
- Kontrollera att migrationerna är idempotenta (t.ex. `IF NOT EXISTS`)

## Nya npm-paket

Om du lägger till paket i `package.json` (backend eller delade):

- `npm run deploy:v2` kör `npm install` på servern
- Dev-paket hoppas över (`--omit=dev`)

## Endast frontend-ändringar

Om du bara ändrat JS/CSS/HTML i frontend:

- Deploy uppdaterar hela `v2/` – backend startas om men ändras inte
- Du kan skippa `npm install` och `db:migrate` om du vill, men det är ofta enklast att köra hela deploy

## Endast backend-ändringar

Om du bara ändrat `server/`:

- Deploy laddar upp server-filerna och kör `pm2 restart`
- Frontend byggs fortfarande (kan ta några sekunder extra)

## Felsökning

| Problem | Kontroll |
|---------|----------|
| Sidan visar bara byggdatum | Nginx serverar inte assets – kolla `chmod o+rX v2/` och nginx-config |
| "Servern svarar inte" | Backend eller API-proxy – kolla Docker, Postgres, PM2, SELinux |
| 502 Bad Gateway | Nginx kan inte nå backend – kolla `setsebool httpd_can_network_connect 1` |
| Permission denied | `chmod -R o+rX /var/www/granskningsverktyget-v2/v2` |
| **Radering fungerar inte** | Nginx: `location /v2/api/` måste komma FÖRE `location /v2/` i config. Annars kan try_files fånga DELETE/PUT och ge 405. Uppdatera enligt `scripts/ux-granskning-with-v2.conf` |
| **Regelfil kan inte raderas** | Regelfiler som används av granskningar blockeras (409). Radera granskningarna först, sedan regelfilen |
| **500 Internal Server Error** | Se nedan |

### Felsökning av 500 Internal Server Error

500 betyder att backend svarar men något fel inträffar i en route. Kör dessa kommandon på servern:

```bash
# 1. Kolla PM2-loggar (här syns felmeddelanden)
pm2 logs granskningsverktyget-v2 --lines 50

# 2. Testa backend direkt (kringgår nginx)
curl -s http://localhost:3000/api/health
# Eller diagnostik (visar om migrationer körts):
curl -s http://localhost:3000/api/debug-status

# 3. Om health ger 503: databasen kör inte. Starta Docker:
cd /var/www/granskningsverktyget-v2 && docker compose up -d

# 4. Kontrollera att .env finns på servern
ls -la /var/www/granskningsverktyget-v2/.env

# 5. Om .env saknas – skapa den (enligt deploy-v2-server-setup.md):
echo 'DATABASE_URL=postgresql://granskning:granskning@localhost:5432/granskningsverktyget' > .env
echo 'API_PORT=3000' >> .env

# 6. Kör migrationer manuellt om det behövs
cd /var/www/granskningsverktyget-v2 && npm run db:migrate

# 7. Starta om backend
pm2 restart granskningsverktyget-v2
```

**Vanliga orsaker till 500:**
- **Databas ej startad** – `docker compose up -d` i projektmappen
- **Saknad .env** – deploy kopierar inte .env (av säkerhetsskäl). Skapa den manuellt på servern
- **Migrationer ej körda** – kolumnen `rule_file_content` saknas i `audits` → `npm run db:migrate`
