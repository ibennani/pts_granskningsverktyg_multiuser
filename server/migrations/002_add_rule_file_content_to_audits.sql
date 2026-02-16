-- Granskningar ska lagra regelfilens innehåll själva så de inte blir "föräldralösa" om rule_set raderas.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS rule_file_content JSONB;

-- Fyll i befintliga granskningar från rule_sets (en engångsåtgärd)
UPDATE audits a
SET rule_file_content = r.content
FROM rule_sets r
WHERE a.rule_set_id = r.id AND a.rule_file_content IS NULL;
