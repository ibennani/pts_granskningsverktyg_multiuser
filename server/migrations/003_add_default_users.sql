-- Lägg till standardanvändare så att inloggning fungerar
INSERT INTO users (name)
SELECT 'Ilias Bennani'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Ilias Bennani' LIMIT 1);

INSERT INTO users (name)
SELECT 'Claudio Quidral'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Claudio Quidral' LIMIT 1);
