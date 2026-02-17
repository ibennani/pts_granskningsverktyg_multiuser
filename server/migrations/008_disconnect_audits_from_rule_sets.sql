-- Granskningar och regelfiler ska existera separat.
-- rule_file_content finns redan i audits (från migration 002).
UPDATE audits SET rule_set_id = NULL WHERE rule_set_id IS NOT NULL;
