-- Varningsdetaljer per färdig sidrapport (visas i listan).

ALTER TABLE audit_snapshots
    ADD COLUMN IF NOT EXISTS warnings_json JSONB;
