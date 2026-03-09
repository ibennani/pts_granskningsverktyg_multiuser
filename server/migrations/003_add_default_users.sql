-- Lägg till standardanvändare så att inloggning fungerar (endast om username-kolumnen inte finns än).
-- När 014 redan kört har tabellen username NOT NULL, då ska vi inte infoga med enbart name.
INSERT INTO users (name)
SELECT 'Ilias Bennani'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Ilias Bennani' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username');

INSERT INTO users (name)
SELECT 'Claudio Quidral'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Claudio Quidral' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username');
