# Databasens persistence

Granskningar och regelfiler sparas i PostgreSQL i en Docker-volym. Data ska finnas kvar mellan omstarter.

## Automatisk persistence

- **Docker Compose-projekt:** `sessionversion` (se `name:` i `docker-compose.yml` i repo).
- **Volym:** den namngivna volymen `pgdata` prefixas med projektnamnet, t.ex. **`sessionversion_pgdata`** (inte samma namn som databasen `granskningsverktyget` i Postgres).
- **Vid `npm run dev`:** `scripts/dev-with-docker.js` kör `docker compose -p sessionversion up -d --wait` och startar därefter backend när Postgres svarar.
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
