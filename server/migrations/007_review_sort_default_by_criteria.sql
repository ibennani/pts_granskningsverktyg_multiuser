-- Ändra standard för review_sort_preference till by_criteria (Sorterat per krav)
ALTER TABLE users ALTER COLUMN review_sort_preference SET DEFAULT 'by_criteria';
