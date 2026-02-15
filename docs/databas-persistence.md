# Databasens persistence

Granskningar och regelfiler sparas i PostgreSQL i en Docker-volym. Data ska finnas kvar mellan omstarter.

## Automatisk persistence

- **Volym:** `granskningsverktyget_pgdata` (namngiven volym)
- **Vid `npm run dev`:** Docker startar med `--wait` och väntar på databasens healthcheck innan migration körs
- **Vid stopp:** Använd `npm run dev:stop` (stoppar containrar men behåller volymen)

## Viktigt: Behåll data

Kör **aldrig** `docker compose down -v` – flaggan `-v` tar bort volymer och raderar all data.

För att stoppa utan att förlora data:
```bash
npm run dev:stop
# eller
docker compose stop
```

## Kontrollera databasen

```bash
npm run db:status
```

Visar antal regelfiler, granskningar och eventuella granskningar utan kopplad regelfil.

## Om data saknas efter omstart

1. Kör `npm run db:status` – finns data kvar?
2. Om databasen är tom: Kontrollera att du inte kört `docker compose down -v`
3. Om granskningar saknar regelfil: Ladda upp dem igen via Admin → "Ladda upp granskning"
