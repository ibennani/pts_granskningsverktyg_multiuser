-- Sä användare när tabellen är tom (t.ex. efter deploy där 003 inte infogade pga username redan fanns).
INSERT INTO users (username, name, is_admin)
SELECT u.username, u.name, u.is_admin
FROM (VALUES
    ('iliasb', 'Ilias Bennani', false),
    ('claudioq', 'Claudio Quidral', false)
) AS u(username, name, is_admin)
WHERE (SELECT COUNT(*) FROM users) = 0;
