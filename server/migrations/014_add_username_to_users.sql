-- Lägg till användarnamn för inloggning

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- Sätt ett första användarnamn för befintliga användare om saknas.
-- Vi utgår från hela namnet, tar bort mellanslag/icke-alfanumeriska tecken och gör gemener.
-- Om name är NULL eller tomt ger det tom sträng – använd då id som fallback så att NOT NULL uppfylls.
UPDATE users
SET username = COALESCE(
    NULLIF(LOWER(REGEXP_REPLACE(TRIM(COALESCE(name, '')), '[^A-Za-z0-9]+', '', 'g')), ''),
    'user-' || id::text
)
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

