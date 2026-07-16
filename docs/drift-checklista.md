# Driftchecklista – Leffe (produktion v2 + test-server)

Kort checklista för stabil drift. PM2-processnamn och sökvägar kan heta `granskningsverktyget-*` (historiskt).

## Automatisk övervakning (normal drift)

| Lager | Intervall | Vad som händer |
|-------|-----------|----------------|
| **PM2** | Omedelbart | Startar om processen om den kraschar |
| **Watchdog** | 45 sek | Testar `/api/health` för v2 och test-server; startar om backend eller Postgres |
| **PM2 backup-drift** | 5 min | Samma health-check som cron, via PM2-process (används om crontab är spärrat) |
| **Boot** | Vid omstart | Postgres, v2, test-server, watchdog via PM2 systemd |

Konfigurera allt: `npm run setup:drift` (kräver SSH; `DEPLOY_SUDO_PASSWORD` i `.env` för systemd enable).

## Daglig / vid behov

1. **PM2**
   - `pm2 status`
   - Ska finnas: `granskningsverktyget-v2`, `granskningsverktyget-test-server`, `granskningsverktyget-watchdog`, `granskningsverktyget-drift-backup`

2. **Postgres (Docker)**
   - Containern `granskningsverktyget-db` ska vara Up
   - Watchdog och cron försöker starta Postgres automatiskt vid fel

3. **Loggar**
   - `pm2 logs granskningsverktyget-v2 --lines 50`
   - `pm2 logs granskningsverktyget-test-server --lines 50`
   - `pm2 logs granskningsverktyget-watchdog --lines 30`
   - Cron: `/var/www/granskningsverktyget-v2/logs/healthcheck.log`

4. **Hälsa**
   - `curl -s http://localhost:3000/api/health` (v2)
   - `curl -s http://localhost:3001/api/health` (test-server)
   - Watchdog-heartbeat: `logs/watchdog.heartbeat` (uppdateras var 45:e sekund)

## Efter omstart av server

Kör **`npm run setup:drift`** om boot inte konfigurerats, eller kontrollera:

- `systemctl is-enabled pm2-<användare>.service` → enabled
- `systemctl is-enabled nginx docker` → enabled
- `crontab -l` innehåller `health-check-and-restart.sh`

Manuell omstart av alla tjänster på servern:

```bash
cd /var/www/granskningsverktyget-v2
bash scripts/server-boot-leffe.sh
```

## Backup och återställning

- **Backup:** `npm run db:backup:remote`
- **Diagnostik:** `npm run diagnose:v2`

## Cron (exempel)

Docker-städning (separat från health-cron):

```cron
0 4 * * 0 /var/www/granskningsverktyget-v2/scripts/cleanup-docker-remote.sh >> /var/log/gv-docker-cleanup.log 2>&1
```
