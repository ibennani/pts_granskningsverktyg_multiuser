/**
 * Hjälpfunktioner för att hantera regelfil-innehåll från databasen.
 * I Postgres kan json/jsonb komma tillbaka antingen som objekt eller som JSON-sträng,
 * beroende på drivrutin/inställningar. Dessa helpers gör hanteringen robust.
 */

/**
 * Försöker normalisera regelfilsinnehåll till ett objekt.
 *
 * @param {unknown} content - Regelfilens `content`/`published_content` från DB.
 * @returns {object|null} Ett objekt om innehållet kan tolkas, annars null.
 */
export function normalize_rulefile_content_object(content) {
    if (content && typeof content === 'object') {
        return content;
    }
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
}

