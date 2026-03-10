-- Tidsstämpel som endast uppdateras när användaren sparar innehållet i regelfilen
-- (inte vid publicering, byta namn eller skapa kopia). Används för "Senast uppdaterad" i arbetskopior.
ALTER TABLE rule_sets
    ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMP;

-- Befintliga rader får content_updated_at = updated_at så att listan visar något.
UPDATE rule_sets
SET content_updated_at = updated_at
WHERE content_updated_at IS NULL;
