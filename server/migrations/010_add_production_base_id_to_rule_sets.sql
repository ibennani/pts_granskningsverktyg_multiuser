-- Lägg till koppling mellan produktionskopia och publicerad regelfil.
-- production_base_id pekar på den publicerade regelfilens id när raden är en produktionskopia.
ALTER TABLE rule_sets
    ADD COLUMN IF NOT EXISTS production_base_id UUID REFERENCES rule_sets(id);

