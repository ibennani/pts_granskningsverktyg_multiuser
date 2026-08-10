-- Tekniska snapshots per granskningsdel (server-side capture jobs).

CREATE TABLE IF NOT EXISTS audit_snapshots (
    id UUID PRIMARY KEY,
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    sample_id TEXT NOT NULL,
    requested_url TEXT NOT NULL,
    final_url TEXT,
    page_title TEXT,
    screenshot_filename TEXT,
    archive_filename TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    warning_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    size_bytes BIGINT,
    visible_phase_completed_at TIMESTAMP,
    superseded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_snapshots_status_check CHECK (
        status IN ('queued', 'capturing', 'packaging', 'ready', 'failed', 'cancelled', 'superseded')
    )
);

CREATE INDEX IF NOT EXISTS audit_snapshots_audit_id_idx ON audit_snapshots(audit_id);
CREATE INDEX IF NOT EXISTS audit_snapshots_audit_sample_idx ON audit_snapshots(audit_id, sample_id);
CREATE INDEX IF NOT EXISTS audit_snapshots_status_idx ON audit_snapshots(status);
