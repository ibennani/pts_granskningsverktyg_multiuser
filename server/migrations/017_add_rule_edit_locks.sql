-- Lås per fält (lease) för samredigering av regelfiler.
-- Syfte: förhindra att två användare redigerar exakt samma fält samtidigt,
-- samtidigt som andra fält i samma regelfil fortfarande kan redigeras parallellt.

CREATE TABLE IF NOT EXISTS rule_edit_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_set_id UUID NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    part_key TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    client_lock_id UUID NOT NULL,
    lease_until TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- En aktiv lease per (regelfil, fält).
CREATE UNIQUE INDEX IF NOT EXISTS rule_edit_locks_rule_set_part_unique
    ON rule_edit_locks(rule_set_id, part_key);

-- Snabba upp städning och listning av aktiva lease.
CREATE INDEX IF NOT EXISTS rule_edit_locks_lease_until_idx
    ON rule_edit_locks(lease_until);

CREATE INDEX IF NOT EXISTS rule_edit_locks_rule_set_id_idx
    ON rule_edit_locks(rule_set_id);

