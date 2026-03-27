# Versionskontrakt för granskningar (audits) i Leffe

## Server

- Kolumnen `audits.version` är ett heltal som **ökas med 1** vid varje lyckad uppdatering som ändrar granskningen (PATCH på `/api/audits/:id`, inklusive detalj-PATCH på resultat).
- **GET** av en granskning returnerar alltid aktuell `version` i JSON-svaret.
- **PATCH** `/api/audits/:id` kräver fältet **`expectedVersion`** i JSON-body: det ska vara samma heltal som klienten fick vid senaste läsning/skrift. Uppdateringen körs som `UPDATE ... WHERE id = ? AND version = ?`; vid mismatch svarar servern med **409** och `{ error, serverVersion }`.

## Klient

- Vid autospar skickas `expectedVersion` från aktuellt state (`state.version`).
- Vid **409** på huvud-PATCH: hämta om granskningen från servern och ersätt lokalt state (senaste version på servern gäller).
