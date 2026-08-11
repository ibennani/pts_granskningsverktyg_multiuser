/**
 * Enhetstester för granskningens Bilaga 2-översikt (åtgärder → malltexter).
 */
import { describe, test, expect } from '@jest/globals';
import { render_audit_appendix2_view_section } from '../../js/components/audit_actions_appendix_render.ts';
import { resolve_appendix2_taxonomy_column_labels_for_audit } from '../../js/logic/appendix2_taxonomy_view.ts';
import { EditAuditAppendix2Component } from '../../js/components/audit_actions/EditAuditAppendix2Component.ts';

const RULE_WITH_TAXONOMIES = {
    appendix2: {
        labelsByLocale: {
            'sv-SE': {
                sheetNames: { general_info: 'Allmän info', deficiencies: 'Brister' },
                generalInfo: [{ key: 'case_number', label: 'Ärendenummer' }],
                deficiencyColumns: [
                    { key: 'id', label: 'Brist-id' },
                    { key: 'reqTitle', label: 'Krav' },
                    { key: 'wcagPerceivable', label: 'Uppfattningsbar (WCAG)' },
                ],
            },
        },
    },
    metadata: {
        language: 'sv-SE',
        primaryGroupingTaxonomyId: 'fptt-bilaga-2',
        taxonomies: [
            {
                id: 'wcag22-pour',
                concepts: [
                    { id: 'perceivable', label: 'Uppfattningsbar (POUR)' },
                    { id: 'operable', label: 'Hanterbar (POUR)' },
                ],
            },
            {
                id: 'fptt-bilaga-2',
                concepts: [
                    { id: 'fptt-uppfattningsbar', label: 'Uppfattningsbar (FPTT)' },
                    { id: 'fptt-hanterbar', label: 'Hanterbar (FPTT)' },
                ],
            },
        ],
        auditTypes: [
            { id: 'tillsyn-lptt', label: 'Tillsyn', taxonomyId: 'wcag22-pour' },
            { id: 'marknadskontroll-lptt', label: 'Marknadskontroll', taxonomyId: 'fptt-bilaga-2' },
        ],
    },
};

function create_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
            const el = document.createElement(tag);
            const class_name = opts.class_name;
            if (typeof class_name === 'string') {
                el.className = class_name;
            } else if (Array.isArray(class_name)) {
                el.className = class_name.join(' ');
            }
            if (typeof opts.text_content === 'string') {
                el.textContent = opts.text_content;
            }
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
        get_icon_svg: () => '',
    };
}

function list_texts(section: HTMLElement): string[] {
    return Array.from(section.querySelectorAll('.rulefile-appendix2-value-list li')).map(
        (item) => item.textContent ?? ''
    );
}

describe('resolve_appendix2_taxonomy_column_labels_for_audit', () => {
    test('använder POUR-kolumner för tillsyn', () => {
        const labels = resolve_appendix2_taxonomy_column_labels_for_audit(
            {
                ruleFileContent: RULE_WITH_TAXONOMIES,
                auditMetadata: { auditTypeId: 'tillsyn-lptt' },
            },
            (key) => key
        );

        expect(labels).toEqual(['Uppfattningsbar (POUR)', 'Hanterbar (POUR)']);
    });

    test('använder FPTT-kolumner för marknadskontroll', () => {
        const labels = resolve_appendix2_taxonomy_column_labels_for_audit(
            {
                ruleFileContent: RULE_WITH_TAXONOMIES,
                auditMetadata: { auditTypeId: 'marknadskontroll-lptt' },
            },
            (key) => key
        );

        expect(labels).toEqual(['Uppfattningsbar (FPTT)', 'Hanterbar (FPTT)']);
    });
});

describe('render_audit_appendix2_view_section', () => {
    test('visar taxonomikolumner för granskningstypen, inte WCAG-legacy', () => {
        const section = render_audit_appendix2_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
                router: () => {},
            },
            {
                ruleFileContent: RULE_WITH_TAXONOMIES,
                auditMetadata: { auditTypeId: 'marknadskontroll-lptt' },
            }
        );

        const lists = section.querySelectorAll('.rulefile-appendix2-value-list');
        const deficiency_list = lists[lists.length - 1];
        const labels = Array.from(deficiency_list.querySelectorAll('li')).map(
            (item) => item.textContent ?? ''
        );

        expect(labels).toContain('Brist-id');
        expect(labels).toContain('Krav');
        expect(labels).not.toContain('Uppfattningsbar (WCAG)');
        expect(labels).toContain('Uppfattningsbar (FPTT)');
        expect(labels).toContain('Hanterbar (FPTT)');
        expect(labels).not.toContain('Uppfattningsbar (POUR)');
    });

    test('visar POUR-taxonomikolumner för tillsyn', () => {
        const section = render_audit_appendix2_view_section(
            {
                Helpers: create_helpers(),
                Translation: { t: (key: string) => key },
                router: () => {},
            },
            {
                ruleFileContent: RULE_WITH_TAXONOMIES,
                auditMetadata: { auditTypeId: 'tillsyn-lptt' },
            }
        );

        const lists = section.querySelectorAll('.rulefile-appendix2-value-list');
        const deficiency_list = lists[lists.length - 1];
        const labels = list_texts(deficiency_list as HTMLElement);

        expect(labels).toContain('Uppfattningsbar (POUR)');
        expect(labels).not.toContain('Uppfattningsbar (FPTT)');
    });
});

describe('EditAuditAppendix2Component', () => {
    test('visar skrivskyddad taxonomikolumnlista i redigeringsvyn', async () => {
        const comp = new EditAuditAppendix2Component();
        const root = document.createElement('div');

        await comp.init({
            root,
            deps: {
                router: () => {},
                getState: () => ({
                    ruleFileContent: RULE_WITH_TAXONOMIES,
                    auditMetadata: { auditTypeId: 'marknadskontroll-lptt' },
                }),
                dispatch: async () => {},
                StoreActionTypes: { UPDATE_METADATA: 'UPDATE_METADATA' },
                Translation: { t: (key: string) => key },
                Helpers: create_helpers(),
                NotificationComponent: { show_global_message: () => {} },
            },
        });

        comp.render();

        const taxonomy_list = root.querySelector('.rulefile-appendix2-taxonomy-columns-list');
        expect(taxonomy_list).toBeTruthy();
        expect(list_texts(taxonomy_list as HTMLElement)).toEqual([
            'Uppfattningsbar (FPTT)',
            'Hanterbar (FPTT)',
        ]);
        expect(root.querySelector('#appendix2-deficiency-wcagPerceivable')).toBeNull();
    });
});
