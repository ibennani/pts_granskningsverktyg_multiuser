-- Lägg till kolumn för publicerad regelfil så att vi kan skilja
-- på publicerat innehåll (används i granskningar) och pågående utkast.
ALTER TABLE rule_sets
    ADD COLUMN IF NOT EXISTS published_content JSONB;

-- Initiera publicerad innehåll med befintlig regelfil.
UPDATE rule_sets
SET published_content = content
WHERE published_content IS NULL;

