/**
 * @fileoverview Populerar FPTT bilaga 2-taxonomin och kravkopplingar i arbetskopior.
 * Kör: node scripts/apply_fptt_bilaga2_taxonomy.mjs
 */
import pg from 'pg';

const TAXONOMY_ID = 'fptt-bilaga-2';
const TAXONOMY_LABEL = 'FPTT, bilaga 2';

const FPTT_CONCEPTS = [
    { label: 'Mer än ett sinne', letters: ['a'] },
    { label: 'Begriplig presentation', letters: ['b'] },
    { label: 'Uppfattningsbar presentation', letters: ['c'] },
    { label: 'Alternativa stödjande format', letters: ['d'] },
    { label: 'Visuella textegenskaper', letters: ['e'] },
    { label: 'Alternativ presentation för icke-textinnehåll', letters: ['f'] },
];

/** Kravtitel (tabell) → bokstäver a–f enligt FPTT bilaga 2 punkt 2. */
const TITLE_TO_LETTERS = new Map([
    ['Icke-textinnehåll (bilder)', ['a', 'e', 'f']],
    ['Icke-textinnehåll (ljud och video)', ['a', 'e', 'f']],
    ['Textalternativ för förinspelad video utan talat ljud', ['a', 'e', 'f']],
    ['Textalternativ för förinspelat ljud', ['a', 'e', 'f']],
    ['Undertexter vid förinspelad video', ['a', 'e', 'f']],
    ['Syntolkning eller mediealternativ vid förinspelad video', ['a', 'e', 'f']],
    ['Undertexter vid direktsändning', ['a', 'e', 'f']],
    ['Syntolkning i förinspelad video', ['a', 'e', 'f']],
    ['Information och relationer för etiketter och ledtexter', ['a', 'b', 'e']],
    ['Information och relationer för landmärken', ['a', 'b', 'e']],
    ['Information och relationer för listor', ['a', 'b', 'e']],
    ['Information och relationer för roller', ['a', 'b', 'e']],
    ['Information och relationer för rubriker', ['a', 'b', 'e']],
    ['Information och relationer för tabeller', ['a', 'b', 'e']],
    ['Information och relationer för visuell presentation', ['a', 'b', 'e']],
    ['Innehållets ordning', ['a', 'b', 'e']],
    ['Ikon och symbol för knappar eller länkar', ['a', 'b', 'e', 'f']],
    ['Sensoriska hänvisningar', ['a', 'b', 'c']],
    ['Orientering (stående eller liggande)', ['c']],
    ['Identifiera syfte med inmatningsfält', ['a', 'b', 'e']],
    ['Användning av färg generellt', ['a', 'c']],
    ['Färganvändning för felmeddelanden', ['a', 'b', 'c']],
    ['Färganvändning för länkar', ['a', 'c']],
    ['Ljudkontroll', ['c']],
    ['Kontrast (minimum) för text i bilder', ['c', 'd']],
    ['Kontrast (minimum) mellan text och bakgrund', ['c', 'd']],
    ['Kontrast (minimum) när bilden visuellt ersätts av ALT-texten', ['c', 'd', 'f']],
    ['Ändra textstorlek', ['c', 'd']],
    ['Bilder av text', ['a', 'c', 'd', 'e', 'f']],
    ['Flexibel layout', ['c']],
    ['Kontrast för fokusmarkering', ['b', 'd']],
    ['Kontrast för interaktiva komponenter', ['c', 'd']],
    ['Kontrast i grafik', ['c', 'd']],
    ['Texavstånd', ['d']],
    ['Uppdykande innehåll vid fokus', ['c']],
    ['Uppdykande innehåll vid hovring', ['c']],
    ['Hantera enbart med tangentbord', ['b']],
    ['Ingen tangentbordsfälla', ['b']],
    ['En-knapps snabbtangenter', ['b']],
    ['Automatisk omladdning', ['b']],
    ['Justera tidsgränser', ['b']],
    ['Pausa eller stäng av rörelser', ['c']],
    ['Tre blinkningar eller under tröskelvärdet', ['c']],
    ['Hoppa förbi återkommande innehåll', ['b']],
    ['Sidans titel', ['a', 'b', 'e']],
    ['Meningsfull fokusordning', ['a', 'b', 'e']],
    ['Syfte för länkar', ['a', 'b', 'e']],
    ['Flera sätt att navigera', ['b']],
    ['Beskrivande ledtexter', ['a', 'b', 'e']],
    ['Beskrivande rubriker', ['a', 'b', 'e']],
    ['Synlig fokusmarkering', ['b', 'd']],
    ['Fokus inte dolt', ['b', 'd']],
    ['Komplexa fingerrörelser', ['b']],
    ['Ångra klick', ['b']],
    ['Etiketter i namn', ['a', 'b', 'e']],
    ['Rörelsestyrning', ['b']],
    ['Dragrörelser', ['b']],
    ['Klickyta', ['b']],
    ['Sidans språk', ['a', 'b', 'e']],
    ['Språk för textalternativ', ['a', 'b', 'e']],
    ['Språkförändringar', ['a', 'b', 'e']],
    ['Kontextförändring vid fokus', ['b']],
    ['Kontextförändring vid inmatning', ['b']],
    ['Konsekvent navigering', ['b']],
    ['Konsekvent identifiering', ['a', 'b', 'e']],
    ['Konsekvent hjälp', ['b']],
    ['Felidentifiering', ['a', 'b', 'e']],
    ['Ledtexter, instruktioner', ['a', 'b', 'e']],
    ['Korrigeringsförslag', ['b']],
    ['Förebyggande av fel (juridiskt, ekonomiskt, data)', ['b']],
    ['Upprepad inmatning', ['b']],
    ['Tillgänglig autentisering', ['b']],
    ['Namn, Roll, Värde', ['a', 'b', 'e']],
    ['Statusmeddelanden', ['a', 'b', 'e']],
]);

/** Gemensamma titelvarianter (webb + PDF). */
const TITLE_ALIASES = new Map([
    ['Textavstånd', 'Texavstånd'],
    [
        'Syntolkning eller mediaalternativ vid förinspelad video',
        'Syntolkning eller mediealternativ vid förinspelad video',
    ],
]);

/** PDF-regelfil: avvikande titlar mappas till tabellens kravtitlar. */
const PDF_TITLE_ALIASES = new Map([
    ['Dokumentets titel', 'Sidans titel'],
    ['Dokumentets språk', 'Sidans språk'],
    ['Kontrast mellan text och bakgrund', 'Kontrast (minimum) mellan text och bakgrund'],
    ['Kontrast för text i bilder', 'Kontrast (minimum) för text i bilder'],
    ['Kontrast i informationsbärande grafik', 'Kontrast i grafik'],
    ['Etikett i namn', 'Etiketter i namn'],
    ['Etiketter och ledtexter för formulärfält', 'Information och relationer för etiketter och ledtexter'],
    ['Ledtexter och instruktioner för formulärfält', 'Ledtexter, instruktioner'],
    ['Instruktioner och hänvisningar utan sensoriska kännetecken', 'Sensoriska hänvisningar'],
    ['Maskinläsbar uppdelning av större språkblock', 'Information och relationer för roller'],
    ['Språkattribut vid språkväxlingar i löpande innehåll', 'Språkförändringar'],
    ['Språkattribut för större språkblock', 'Språk för textalternativ'],
    ['Namn, roll och värde för interaktiva komponenter', 'Namn, Roll, Värde'],
]);

const RULEFILE_IDS = [
    '568f8c0a-96cc-4ebe-9469-90bfd85c03f3',
    '31a46124-c999-4c2e-b367-89a8f1c86821',
];

function slug_from_label(label, fallback) {
    const slug = label
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
}

function build_concept_entries() {
    return FPTT_CONCEPTS.map((concept, index) => ({
        id: slug_from_label(concept.label, `concept-${index + 1}`),
        label: concept.label,
    }));
}

function build_letter_to_concept_id(concepts) {
    const map = new Map();
    FPTT_CONCEPTS.forEach((spec, index) => {
        for (const letter of spec.letters) {
            map.set(letter, concepts[index].id);
        }
    });
    return map;
}

function normalize_title(title) {
    return String(title ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/mediealternativ/gi, 'mediaalternativ');
}

function resolve_table_title(title, use_pdf_aliases) {
    const normalized = normalize_title(title);
    if (TITLE_ALIASES.has(normalized)) {
        return TITLE_ALIASES.get(normalized);
    }
    if (use_pdf_aliases && PDF_TITLE_ALIASES.has(normalized)) {
        return PDF_TITLE_ALIASES.get(normalized);
    }
    return normalized;
}

function apply_fptt_classifications(requirement, letters, letter_to_concept_id) {
    const existing = Array.isArray(requirement.classifications) ? requirement.classifications : [];
    const preserved = existing.filter(
        (entry) => String(entry?.taxonomyId ?? '').trim().toLowerCase() !== TAXONOMY_ID
    );
    const concept_ids = [...new Set(
        letters.map((letter) => letter_to_concept_id.get(letter)).filter(Boolean)
    )];
    const fptt_entries = concept_ids.map((concept_id) => ({
        taxonomyId: TAXONOMY_ID,
        conceptId: concept_id,
    }));
    return {
        ...requirement,
        classifications: [...preserved, ...fptt_entries],
    };
}

function upsert_fptt_taxonomy(metadata, concepts) {
    if (!Array.isArray(metadata.taxonomies)) {
        metadata.taxonomies = [];
    }
    const index = metadata.taxonomies.findIndex(
        (row) => String(row?.id ?? '').trim().toLowerCase() === TAXONOMY_ID
    );
    const entry = {
        id: TAXONOMY_ID,
        label: TAXONOMY_LABEL,
        version: '',
        uri: '',
        concepts,
    };
    if (index >= 0) {
        metadata.taxonomies[index] = entry;
    } else {
        metadata.taxonomies.push(entry);
    }
}

function apply_to_rulefile(content, use_pdf_aliases) {
    const concepts = build_concept_entries();
    const letter_to_concept_id = build_letter_to_concept_id(concepts);
    const metadata = content.metadata ?? {};
    upsert_fptt_taxonomy(metadata, concepts);
    content.metadata = metadata;

    const requirements = content.requirements ?? {};
    const unmatched = [];
    let mapped_count = 0;

    for (const [key, requirement] of Object.entries(requirements)) {
        const table_title = resolve_table_title(requirement.title, use_pdf_aliases);
        const letters = TITLE_TO_LETTERS.get(table_title);
        if (!letters) {
            unmatched.push({ key, title: requirement.title });
            continue;
        }
        requirements[key] = apply_fptt_classifications(requirement, letters, letter_to_concept_id);
        mapped_count += 1;
    }

    content.requirements = requirements;
    return { mapped_count, unmatched, concept_count: concepts.length };
}

async function main() {
    const pool = new pg.Pool({
        connectionString:
            process.env.DATABASE_URL
            || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget',
    });

    for (const rulefile_id of RULEFILE_IDS) {
        const result = await pool.query(
            'SELECT id, name, content FROM rule_sets WHERE id = $1',
            [rulefile_id]
        );
        if (result.rows.length === 0) {
            console.error(`Regelfil saknas: ${rulefile_id}`);
            continue;
        }
        const row = result.rows[0];
        const content = structuredClone(row.content);
        const use_pdf_aliases = rulefile_id === '31a46124-c999-4c2e-b367-89a8f1c86821';
        const stats = apply_to_rulefile(content, use_pdf_aliases);

        await pool.query(
            `UPDATE rule_sets
             SET content = $1::jsonb,
                 content_updated_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [JSON.stringify(content), rulefile_id]
        );

        console.log(`\n${row.name}`);
        console.log(`  Principer i taxonomin: ${stats.concept_count}`);
        console.log(`  Krav kopplade: ${stats.mapped_count}`);
        if (stats.unmatched.length > 0) {
            console.log(`  Ej matchade krav (${stats.unmatched.length}):`);
            for (const item of stats.unmatched) {
                console.log(`    - ${item.title}`);
            }
        }
    }

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
