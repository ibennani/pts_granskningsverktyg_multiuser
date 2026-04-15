-- Lås per fält (lease) för samredigering av granskningar.
-- Syfte: förhindra att två användare redigerar exakt samma fält samtidigt.

CREATE TABLE IF NOT EXISTS audit_edit_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    part_key TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    client_lock_id UUID NOT NULL,
    lease_until TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- En aktiv lease per (granskning, fält).
CREATE UNIQUE INDEX IF NOT EXISTS audit_edit_locks_audit_part_unique
    ON audit_edit_locks(audit_id, part_key);

-- Snabb städning/listning av aktiva lease.
CREATE INDEX IF NOT EXISTS audit_edit_locks_lease_until_idx
    ON audit_edit_locks(lease_until);

CREATE INDEX IF NOT EXISTS audit_edit_locks_audit_id_idx
    ON audit_edit_locks(audit_id);

