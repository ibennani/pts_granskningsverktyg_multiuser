-- Lägg till användarnamn för inloggning

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- Sätt ett första användarnamn för befintliga användare om saknas.
-- Vi utgår från hela namnet, tar bort mellanslag/icke-alfanumeriska tecken och gör gemener.
UPDATE users
SET username = LOWER(REGEXP_REPLACE(name, '[^A-Za-z0-9]+', '', 'g'))
WHERE (username IS NULL OR username = '');

-- Säkerställ att alla användare har ett ifyllt användarnamn.
ALTER TABLE users
    ALTER COLUMN username SET NOT NULL;

-- Förhindra dubbletter av användarnamn.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'users_username_unique'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_username_unique UNIQUE (username);
    END IF;
END
$$;

