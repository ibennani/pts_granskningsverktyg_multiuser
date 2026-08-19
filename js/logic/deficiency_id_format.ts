/**
 * @fileoverview Formatering och normalisering av brist-id (prefix B + siffror).
 */

/** Bokstavsprefix för brist-id i alla språkversioner. */
export const DEFICIENCY_ID_LETTER = 'B';

/** Felaktigt sparat prefix när översättningsmodulen saknades vid tilldelning. */
export const CORRUPT_DEFICIENCY_ID_PREFIX = '**deficiency_prefix**';

/**
 * Normaliserar sparat brist-id till t.ex. B07 (hanterar legacy **deficiency_prefix**07).
 */
export function normalize_deficiency_id(deficiency_id: unknown): string {
    const raw = String(deficiency_id ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith(CORRUPT_DEFICIENCY_ID_PREFIX)) {
        return `${DEFICIENCY_ID_LETTER}${raw.slice(CORRUPT_DEFICIENCY_ID_PREFIX.length)}`;
    }
    if (/^\*\*[^*]+\*\*/.test(raw)) {
        return raw.replace(/^\*\*[^*]+\*\*/, DEFICIENCY_ID_LETTER);
    }
    return raw;
}

/**
 * Returnerar sifferdelen utan B-prefix, t.ex. B07 → 07, **deficiency_prefix**07 → 07.
 */
export function extract_deficiency_number(deficiency_id: unknown): string {
    const normalized = normalize_deficiency_id(deficiency_id);
    if (!normalized) return '';
    return normalized.replace(new RegExp(`^${DEFICIENCY_ID_LETTER}`, 'i'), '');
}

/**
 * Bygger brist-id med rätt padding utifrån totalt antal brister.
 */
export function build_deficiency_id(number: number, total_count: number): string {
    let padding = 1;
    if (total_count >= 100) {
        padding = 3;
    } else if (total_count >= 10) {
        padding = 2;
    }
    return `${DEFICIENCY_ID_LETTER}${String(number).padStart(padding, '0')}`;
}
