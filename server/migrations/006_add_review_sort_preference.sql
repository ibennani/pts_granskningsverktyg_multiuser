-- Lägg till inställning för hur användaren vill granska (per krav eller per stickprov)
ALTER TABLE users ADD COLUMN IF NOT EXISTS review_sort_preference VARCHAR(30) DEFAULT 'by_criteria';
