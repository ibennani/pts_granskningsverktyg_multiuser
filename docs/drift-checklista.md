# Drift-checklista (v2)

Kort checklista för att hålla Granskningsverktyget v2 stabilt och återställningsbart.

## Vid incident (t.ex. 502, appen svarar inte)

1. **Kontrollera hälsa**
   - Öppna `https://ux-granskningsverktyg.pts.ad/v2/api/health` – ska returnera 200 och `{"ok":true}`.

2. **PM2**
   - SSH till servern och kör: `pm2 list`
   - Ser du `granskningsverktyget-v2` och `granskningsverktyget-watchdog`? Om någon är stoppad: `pm2 restart granskningsverktyget-v2` (eller båda).

3. **PostgreSQL**
   - Om health visar 503 eller "database" i felmeddelandet är Postgres ofta nere.
   - **Alltid använd projektnamnet** så att rätt datavolym används:
     ```bash
     cd /var/www/granskningsverktyget-v2
     docker compose -p granskningsverktyget-v2 up -d postgres
     ```
   - Vänta några sekunder och kontrollera: `docker compose -p granskningsverktyget-v2 ps`. Containern `granskningsverktyget-db` ska vara "Up".
   - Watchdog försöker starta Postgres och sedan omstarta backend om health inte är 200; om det fortfarande inte hjälper, starta Postgres manuellt enligt ovan och kör sedan `pm2 restart granskningsverktyget-v2`.

4. **Loggar**
   - `pm2 logs granskningsverktyget-v2 --lines 50`
   - `pm2 logs granskningsverktyget-watchdog --lines 30`

5. **Disk**
   - `df -h` – om disk är full kan loggar eller Docker ta plats. Se "Periodiskt underhåll" nedan.

---

## Efter serveromstart

- PM2 ska starta automatiskt om du har kört `pm2 startup` och `pm2 save` (se `docs/deploy-v2-server-setup.md`).
- Postgres startar **inte** automatiskt med systemet om du inte konfigurerat det (t.ex. systemd eller cron). Vid omstart: starta Postgres med `docker compose -p granskningsverktyget-v2 up -d postgres` i `/var/www/granskningsverktyget-v2`, sedan eventuellt `pm2 restart granskningsverktyget-v2`.

---

## Periodiskt underhåll

### Veckovis (rekommenderat)

- **Backup:** Kör `npm run db:backup:remote` (eller cron på servern) så att senaste dump finns i `/var/www/granskningsverktyget-v2/backups/db/`.
- **Verifiera backup:** Kör `npm run db:backup:verify:remote` för att kontrollera att senaste dump är läsbar.
- **Loggar:** Om pm2-logrotate är installerat (`pm2 install pm2-logrotate`) roteras loggarna automatiskt. Annars, kolla att `~/.pm2/logs` inte växer obegränsat.
- **Disk/Docker:** Kör `npm run cleanup:docker:remote` (eller sätt upp cron på servern, se nedan) så att stoppade containrar och oanvända images rensas. **Datavolymer rensas inte** av skriptet.

### Cron-exempel (på servern)

Kör som användaren som äger PM2 och Docker:

```cron
# Söndag 04:00 – Docker-städning (stoppade containrar, oanvända images; inga volymer)
0 4 * * 0 /var/www/granskningsverktyget-v2/scripts/cleanup-docker-remote.sh >> /var/log/gv-docker-cleanup.log 2>&1
```

Backup kan köras från din lokala maskin med `npm run db:backup:remote` eller via cron på servern om du lägger kommandot där.

---

## Återställning från backup

1. Ladda ner senaste dump från servern, t.ex.  
   `scp användare@ux-granskningsverktyg.pts.ad:/var/www/granskningsverktyget-v2/backups/db/gv_postgres_YYYYMMDDTHHMMSSZ.dump .`
2. På servern (eller där Postgres körs): stoppa appen, återställ med  
   `docker exec -i granskningsverktyget-db pg_restore -U granskning -d granskningsverktyget --clean --if-exists -Fc < /sökväg/till/fil.dump`  
   (anpassa container, användare, databas och sökväg).
3. Starta appen igen: `pm2 restart granskningsverktyget-v2`.

Detaljerade steg för din miljö finns i `docs/deploy-v2-server-setup.md` och i backup-skriptens kommentarer.
