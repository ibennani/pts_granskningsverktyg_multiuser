-- Spårar vem startade snapshot-capture (rättvis kö och «andra användare» i UI).

ALTER TABLE audit_snapshots
    ADD COLUMN IF NOT EXISTS requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS requested_by_user_name TEXT;

CREATE INDEX IF NOT EXISTS audit_snapshots_requested_by_user_idx
    ON audit_snapshots (requested_by_user_id)
    WHERE requested_by_user_id IS NOT NULL;
