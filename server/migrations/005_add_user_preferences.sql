-- Lägg till användarinställningar (språk och tema)
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(20) DEFAULT NULL;
