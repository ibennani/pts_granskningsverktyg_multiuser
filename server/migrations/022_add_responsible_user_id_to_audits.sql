-- Ansvarig granskare som användar-id (behörighet för säkerhetskopior m.m.)

ALTER TABLE audits
    ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audits_responsible_user_id ON audits(responsible_user_id);

-- Backfill från metadata.auditorName när matchning mot users.name är entydig
UPDATE audits a
SET responsible_user_id = match.user_id
FROM (
    SELECT a2.id AS audit_id,
           (array_agg(u.id ORDER BY u.created_at ASC))[1] AS user_id,
           COUNT(DISTINCT u.id) AS cnt
    FROM audits a2
    INNER JOIN users u
        ON TRIM(LOWER(COALESCE(a2.metadata->>'auditorName', ''))) = TRIM(LOWER(u.name))
    WHERE a2.responsible_user_id IS NULL
      AND TRIM(COALESCE(a2.metadata->>'auditorName', '')) <> ''
    GROUP BY a2.id
    HAVING COUNT(DISTINCT u.id) = 1
) match
WHERE a.id = match.audit_id
  AND a.responsible_user_id IS NULL;
