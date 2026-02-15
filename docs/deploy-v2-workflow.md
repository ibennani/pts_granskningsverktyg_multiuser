# Deploy-workflow: Lokala ändringar → Servern

När du ändrat frontend eller backend och vill att servern ska fungera som lokalt:

## Snabbversion

```bash
npm run deploy:v2
```

Detta bygger, laddar upp och startar om allt på servern.

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
