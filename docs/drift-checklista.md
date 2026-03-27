# Driftchecklista – Leffe (produktion v2)

Kort checklista för att hålla **Leffe** stabilt i servermiljön v2 och återställningsbar. PM2-processnamn och sökvägar på servern kan fortfarande heta `granskningsverktyget-*` (historiskt); det är **inte** appens visningsnamn.

## Daglig / vid behov

1. **PM2**
   - `pm2 status`
   - Ser du `granskningsverktyget-v2` och `granskningsverktyget-watchdog`? Om någon är stoppad: `pm2 restart granskningsverktyget-v2` (eller båda).

2. **Postgres (Docker)**
   - Om health inte är OK: på servern, i deploy-mappen:
     ```bash
     cd /var/www/granskningsverktyget-v2
     docker compose up -d postgres
     ```
   - `docker compose.yml` i repot definierar projektnamn `sessionversion` och containern `granskningsverktyget-db`.
   - Kontrollera: `docker compose ps` – containern ska vara "Up".
   - Watchdog försöker starta Postgres och omstarta backend vid fel; om det inte räcker: starta Postgres manuellt enligt ovan och kör `pm2 restart granskningsverktyget-v2`.

3. **Loggar**
   - `pm2 logs granskningsverktyget-v2 --lines 50`
   - `pm2 logs granskningsverktyget-watchdog --lines 30`

4. **Hälsa**
   - `curl -s http://localhost:3000/api/health` (på servern)

## Efter omstart av server

- Postgres startar **inte** alltid utan Docker/PM2-start.  
  `cd /var/www/granskningsverktyget-v2 && docker compose up -d postgres`, sedan vid behov `pm2 restart granskningsverktyget-v2`.

## Backup och återställning

- **Backup:** `npm run db:backup:remote` (eller cron) så att senaste dump finns under `/var/www/granskningsverktyget-v2/backups/db/` (om så konfigurerat).

- **Exempel återställning** (anpassa värdar och filnamn):
  - Hämta dump:  
    `scp användare@ux-granskningsverktyg.pts.ad:/var/www/granskningsverktyget-v2/backups/db/gv_postgres_YYYYMMDDTHHMMSSZ.dump .`
  - Återställ (exempel):  
    `docker exec -i granskningsverktyget-db pg_restore -U granskning -d granskningsverktyget --clean --if-exists -Fc < /sökväg/till/fil.dump`
  - Starta appen igen: `pm2 restart granskningsverktyget-v2`.

## Cron (exempel)

```cron
0 4 * * 0 /var/www/granskningsverktyget-v2/scripts/cleanup-docker-remote.sh >> /var/log/gv-docker-cleanup.log 2>&1
```
