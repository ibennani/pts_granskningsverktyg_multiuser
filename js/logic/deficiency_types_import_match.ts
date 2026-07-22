/**
 * @fileoverview Parsning och matchning av masterdata för bristtyper per krav.
 */
import { readFileSync } from 'node:fs';
import { get_requirement_display_label } from './requirement_display_name.js';

export type DeficiencyTypeEntry = {
    criterion: string;
    reference: string;
    title: string;
    primary_text: string;
    secondary_text: string;
};

export type DeficiencyTypeLookup = {
    by_label: Map<string, DeficiencyTypeEntry>;
    by_title: Map<string, DeficiencyTypeEntry>;
};

/** PDF-regelfil: avvikande titlar mappas till tabellens kravtitlar. */
export const PDF_TITLE_TO_MASTER_ALIASES = new Map<string, string>([
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

/** Regelfil vs tabell: titel i regelfilen mappas till titel i masterdata. */
export const REQUIREMENT_TITLE_TO_MASTER_TITLE = new Map<string, string>([
    ['En-knapps snabbtangenter', 'Enknapps snabbtangenter'],
]);

function normalize_lookup_key(value: string): string {
    return value.trim().toLocaleLowerCase('sv-SE');
}

export function parse_criterion_parts(criterion: string): { reference: string; title: string } {
    const trimmed = criterion.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    if (!match) {
        return { reference: '', title: trimmed };
    }
    return { reference: match[1], title: match[2].trim() };
}

export function parse_deficiency_types_tsv(raw_text: string): DeficiencyTypeEntry[] {
    const lines = raw_text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return [];

    const first_cells = lines[0].split('\t');
    const has_header = first_cells[0]?.trim().toLowerCase() === 'kriterie';
    const data_lines = has_header ? lines.slice(1) : lines;

    return data_lines.map((line) => {
        const [criterion = '', primary_text = '', secondary_text = ''] = line.split('\t');
        const { reference, title } = parse_criterion_parts(criterion);
        return {
            criterion: criterion.trim(),
            reference,
            title,
            primary_text: primary_text.trim(),
            secondary_text: secondary_text.trim(),
        };
    });
}

export function read_deficiency_types_tsv(file_path: string): DeficiencyTypeEntry[] {
    const raw_text = readFileSync(file_path, 'utf8');
    return parse_deficiency_types_tsv(raw_text);
}

export function build_deficiency_type_lookup(entries: DeficiencyTypeEntry[]): DeficiencyTypeLookup {
    const by_label = new Map<string, DeficiencyTypeEntry>();
    const by_title = new Map<string, DeficiencyTypeEntry>();

    for (const entry of entries) {
        const label_key = normalize_lookup_key(
            entry.reference ? `${entry.reference} ${entry.title}` : entry.title
        );
        by_label.set(label_key, entry);
        by_title.set(normalize_lookup_key(entry.title), entry);
    }

    return { by_label, by_title };
}

function resolve_master_title(title: string, use_pdf_aliases: boolean): string {
    const trimmed = title.trim();
    if (use_pdf_aliases) {
        const pdf_alias = PDF_TITLE_TO_MASTER_ALIASES.get(trimmed);
        if (pdf_alias) return pdf_alias;
    }
    return REQUIREMENT_TITLE_TO_MASTER_TITLE.get(trimmed) ?? trimmed;
}

export function find_deficiency_type_for_requirement(
    requirement: Record<string, unknown>,
    lookup: DeficiencyTypeLookup,
    options: { use_pdf_aliases?: boolean } = {}
): DeficiencyTypeEntry | null {
    const use_pdf_aliases = options.use_pdf_aliases === true;
    const display_label = get_requirement_display_label(requirement);
    const label_match = lookup.by_label.get(normalize_lookup_key(display_label));
    if (label_match) return label_match;

    const raw_title = typeof requirement.title === 'string' ? requirement.title.trim() : '';
    const resolved_title = resolve_master_title(raw_title, use_pdf_aliases);
    return lookup.by_title.get(normalize_lookup_key(resolved_title)) ?? null;
}

export type ApplyDeficiencyTypesResult = {
    updated_count: number;
    unmatched: Array<{ key: string; title: string; label: string }>;
};

export function apply_deficiency_types_to_content(
    content: Record<string, unknown>,
    lookup: DeficiencyTypeLookup,
    options: { use_pdf_aliases?: boolean; require_all_matches?: boolean } = {}
): ApplyDeficiencyTypesResult {
    const requirements = (content.requirements ?? {}) as Record<string, Record<string, unknown>>;
    const unmatched: ApplyDeficiencyTypesResult['unmatched'] = [];
    let updated_count = 0;

    for (const [key, requirement] of Object.entries(requirements)) {
        const match = find_deficiency_type_for_requirement(requirement, lookup, options);
        if (!match) {
            unmatched.push({
                key,
                title: typeof requirement.title === 'string' ? requirement.title : key,
                label: get_requirement_display_label(requirement),
            });
            continue;
        }
        requirement.DeficiencyType = {
            PrimaryText: match.primary_text,
            SecondaryText: match.secondary_text,
        };
        requirements[key] = requirement;
        updated_count += 1;
    }

    content.requirements = requirements;

    if (options.require_all_matches === true && unmatched.length > 0) {
        const details = unmatched.map((item) => `${item.label} (${item.key})`).join('\n  - ');
        throw new Error(`Kunde inte matcha ${unmatched.length} krav:\n  - ${details}`);
    }

    return { updated_count, unmatched };
}
