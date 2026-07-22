/**
 * @file Enhetstester för import och matchning av bristtyper från master-TSV.
 */
import { describe, test, expect } from '@jest/globals';
import {
    apply_deficiency_types_to_content,
    build_deficiency_type_lookup,
    find_deficiency_type_for_requirement,
    parse_criterion_parts,
    parse_deficiency_types_tsv,
} from '../../js/logic/deficiency_types_import_match.ts';

const SAMPLE_TSV = `Kriterie\tHuvudmening bristtyp\tFörklaring briststyp
1.1.1 Icke-textinnehåll (Bilder)\tPrimär bild\tSekundär bild
1.1.1 Icke-textinnehåll (ljud och video)\tPrimär ljud\tSekundär ljud
Enknapps snabbtangenter\tPrimär snabb\tSekundär snabb
Sidans titel\tPrimär titel\tSekundär titel
`;

describe('deficiency_types_import_match', () => {
    test('parse_criterion_parts extraherar referens och titel', () => {
        expect(parse_criterion_parts('1.1.1 Icke-textinnehåll (bilder)')).toEqual({
            reference: '1.1.1',
            title: 'Icke-textinnehåll (bilder)',
        });
    });

    test('parse_deficiency_types_tsv läser rubrikrad och tre kolumner', () => {
        const entries = parse_deficiency_types_tsv(SAMPLE_TSV);
        expect(entries).toHaveLength(4);
        expect(entries[0]).toMatchObject({
            title: 'Icke-textinnehåll (Bilder)',
            primary_text: 'Primär bild',
            secondary_text: 'Sekundär bild',
        });
    });

    test('find_deficiency_type_for_requirement matchar etikett case-insensitive', () => {
        const lookup = build_deficiency_type_lookup(parse_deficiency_types_tsv(SAMPLE_TSV));
        const match = find_deficiency_type_for_requirement(
            {
                title: 'Icke-textinnehåll (bilder)',
                standardReference: { text: '1.1.1 Non-text Content' },
            },
            lookup
        );
        expect(match?.primary_text).toBe('Primär bild');
    });

    test('find_deficiency_type_for_requirement matchar titelalias En-knapps', () => {
        const lookup = build_deficiency_type_lookup(parse_deficiency_types_tsv(SAMPLE_TSV));
        const match = find_deficiency_type_for_requirement(
            { title: 'En-knapps snabbtangenter' },
            lookup
        );
        expect(match?.primary_text).toBe('Primär snabb');
    });

    test('find_deficiency_type_for_requirement använder PDF-alias till master', () => {
        const lookup = build_deficiency_type_lookup(parse_deficiency_types_tsv(SAMPLE_TSV));
        const match = find_deficiency_type_for_requirement(
            { title: 'Dokumentets titel' },
            lookup,
            { use_pdf_aliases: true }
        );
        expect(match?.primary_text).toBe('Primär titel');
    });

    test('apply_deficiency_types_to_content sätter DeficiencyType på matchade krav', () => {
        const lookup = build_deficiency_type_lookup(parse_deficiency_types_tsv(SAMPLE_TSV));
        const content = {
            requirements: {
                req_a: {
                    id: 'req_a',
                    title: 'Icke-textinnehåll (bilder)',
                    standardReference: { text: '1.1.1 Non-text Content' },
                },
                req_b: {
                    id: 'req_b',
                    title: 'En-knapps snabbtangenter',
                },
            },
        };

        const stats = apply_deficiency_types_to_content(content, lookup, { require_all_matches: false });
        expect(stats.updated_count).toBe(2);
        expect(content.requirements.req_a.DeficiencyType).toEqual({
            PrimaryText: 'Primär bild',
            SecondaryText: 'Sekundär bild',
        });
    });

    test('apply_deficiency_types_to_content kastar vid require_all_matches och saknad rad', () => {
        const lookup = build_deficiency_type_lookup(parse_deficiency_types_tsv(SAMPLE_TSV));
        const content = {
            requirements: {
                req_missing: { id: 'req_missing', title: 'Finns inte i tabellen' },
            },
        };

        expect(() => apply_deficiency_types_to_content(content, lookup, { require_all_matches: true }))
            .toThrow(/Kunde inte matcha 1 krav/);
    });
});
