-- Lagra arkiverade kravresultat och senaste regelfilsuppdatering på granskningar.

ALTER TABLE audits
    ADD COLUMN IF NOT EXISTS archived_requirement_results JSONB,
    ADD COLUMN IF NOT EXISTS last_rulefile_update_log JSONB;

