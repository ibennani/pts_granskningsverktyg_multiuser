/**
 * Normalisering av text för accent-tolerant filtrering (substring-match).
 * Svenska å, ä, ö bevaras; övriga diakriter strippas efter NFD.
 */

/** Privata tecken som platshållare — osannolika i normal text (Unicode Private Use Area). */
const PL_Å = '\uE000';
const PL_Ä = '\uE001';
const PL_Ö = '\uE002';

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Förbereder en sträng för jämförelse: skyddar å/ä/ö, tar bort kombinerande diakriter, gemener.
 */
export function prepareString(text: string): string {
    let s = text;
    s = s.replace(/\u00c5/g, PL_Å).replace(/\u00e5/g, PL_Å);
    s = s.replace(/\u00c4/g, PL_Ä).replace(/\u00e4/g, PL_Ä);
    s = s.replace(/\u00d6/g, PL_Ö).replace(/\u00f6/g, PL_Ö);
    s = s.normalize('NFD').replace(COMBINING_MARKS, '');
    s = s.replace(new RegExp(PL_Å, 'g'), 'å').replace(new RegExp(PL_Ä, 'g'), 'ä').replace(new RegExp(PL_Ö, 'g'), 'ö');
    return s.toLowerCase();
}

/**
 * Tom söksträng räknas som ingen filtrering (matchar allt).
 */
export function filter_text_matches(haystack: string, needle: string): boolean {
    const trimmed = needle.trim();
    if (!trimmed) return true;
    return prepareString(haystack).includes(prepareString(trimmed));
}
