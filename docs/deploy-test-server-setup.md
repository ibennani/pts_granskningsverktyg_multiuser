# Testserver på prod (`/test-server/`)

Isolerad Leffe-instans på samma värd som produktion, med egen databas, filer och backend. URL:

`https://ux-granskningsverktyg.pts.ad/test-server/`

Produktion (`/v2/`) påverkas **inte** vid deploy till testserver.

## Översikt

| | Prod | Testserver |
|---|---|---|
| URL | `/v2/` | `/test-server/` |
| Deploy-mapp | `/var/www/granskningsverktyget-v2` | `/var/www/granskningsverktyget-test-server` |
| PM2 | `granskningsverktyget-v2` | `granskningsverktyget-test-server` |
| API-port | 3000 | 3001 |
| Postgres-databas | `granskningsverktyget` | `granskningsverktyget_test` |

Testservern visar röd viewport-ram och banner: **Leffe testserver - Byggt [datum] kl [tid]**.

## Första gången på servern

SSH till servern och skapa mapp:

```bash
sudo mkdir -p /var/www/granskningsverktyget-test-server
sudo chown $USER:$USER /var/www/granskningsverktyget-test-server
```

Skapa test-databas i befintlig Postgres-container (prod använder redan Docker på port 5432):

```bash
docker exec granskningsverktyget-db psql -U granskning -d postgres -c "CREATE DATABASE granskningsverktyget_test;"
```

Skapa lokal fil **`.env.test-server`** i projektroten (committas inte):

```env
JWT_SECRET=<samma som lokal miljö om användare kopieras från lokal DB>
DATABASE_URL=postgresql://granskning:granskning@localhost:5432/granskningsverktyget_test
API_PORT=3001
PUBLIC_APP_URL=https://ux-granskningsverktyg.pts.ad/test-server
ALLOWED_ORIGINS=https://ux-granskningsverktyg.pts.ad
NODE_ENV=production
GV_BACKUP_DIR=./backup
GV_AUDIT_MEDIA_DIR=./audit-media
```

## Deploy från lokal maskin

1. Seed:a data från lokal miljö (första gången eller vid om-seed):

   ```bat
   npm run seed:test-server -- --confirm
   ```

2. Deploya kod:

   ```bat
   set DEPLOY_TEST_SERVER_COPY_ENV=1
   npm run deploy:test-server
   ```

3. Synka inloggningsuppgifter från v2 (prod) till testservern — **deploy kopierar inte lösenord**:

   ```bat
   npm run copy:v2-users-to-test-server
   ```

4. Öppna `https://ux-granskningsverktyg.pts.ad/test-server/` och kontrollera röd ram + banner.

## Seed från lokal miljö

`npm run seed:test-server` kopierar:

- PostgreSQL-dump från lokal Docker (`sessionversion`, databas `granskningsverktyget`)
- `audit-media/` och valfritt `backup/`

**Varning:** skriver över all data i `granskningsverktyget_test`. Kräver `--confirm`.

Torrkörning: `npm run seed:test-server -- --dry-run`

## Vanliga kommandon

| Kommando | Syfte |
|---|---|
| `npm run build:test-server` | Bygg frontend med bas `/test-server/` |
| `npm run deploy:test-server` | Deploy kod till testservern |
| `npm run copy:v2-users-to-test-server` | Kopiera användare och lösenord från v2 (prod) till testservern |
| `npm run seed:test-server -- --confirm` | Kopiera lokal DB + filer till testservern |
| `npm run setup:test-server` | Seed + deploy i ett steg (kräver SSH) |
| `scripts\setup-test-server.cmd` | Samma som ovan (Windows) |

## SSH-lösenord

Deploy och seed använder `DEPLOY_SSH_PASSWORD` från `.env`. Om du får *Password change required* måste du först byta lösenord på servern (SSH med TTY) innan skripten kan köras.

## Felsökning

- Backend svarar inte: `npx pm2 logs granskningsverktyget-test-server` på servern
- Health: `curl http://127.0.0.1:3001/api/health`
- Nginx: kontrollera att `scripts/ux-granskning-with-v2.conf` innehåller `/test-server`-block
- JWT: om inloggning misslyckas efter seed, kontrollera att `JWT_SECRET` i `.env.test-server` matchar lokal miljö
- **Inloggning efter deploy:** `deploy:test-server` kopierar inte lösenord från v2. Kör `npm run copy:v2-users-to-test-server` så att samma användarnamn och lösenord fungerar som i prod

Se även [`deploy-v2-workflow.md`](deploy-v2-workflow.md) och [`drift-checklista.md`](drift-checklista.md).
