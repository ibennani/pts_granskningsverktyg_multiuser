-- Lägg till lösenordskolumn för JWT-baserad inloggning
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT NULL;
