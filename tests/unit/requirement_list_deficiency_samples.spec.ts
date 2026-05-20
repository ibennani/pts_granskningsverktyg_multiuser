import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { create_all_requirement_list_item } from '../../js/components/requirements_list/requirement_list_list_items.js';

const req_b = { id: 'req-b', key: 'req-b', title: 'Krav med brist' };

const sample_with_b27 = {
    id: 'sp1',
    description: 'Med brist 27',
    requirementResults: {
        'req-b': {
            checkResults: {
                c1: { passCriteria: { p1: { status: 'failed', deficiencyId: 'B27' } } }
            }
        }
    }
};

const sample_without_b27 = {
    id: 'sp2',
    description: 'Utan brist 27',
    requirementResults: {
        'req-b': {
            checkResults: {
                c1: { passCriteria: { p1: { status: 'passed' } } }
            }
        }
    }
};

function minimal_helpers() {
    return {
        create_element: (tag: string, opts: { class_name?: string; text_content?: string; attributes?: Record<string, string> } = {}) => {
            const el = document.createElement(tag);
            if (opts.class_name) el.className = opts.class_name;
            if (opts.text_content) el.textContent = opts.text_content;
            if (opts.attributes) {
                Object.entries(opts.attributes).forEach(([k, v]) => el.setAttribute(k, v));
            }
            return el;
        },
        create_element_with_html: () => document.createElement('span'),
        add_protocol_if_needed: (el: HTMLElement) => el
    };
}

function minimal_translation() {
    const map: Record<string, string> = {
        unknown_value: 'Okänd',
        all_requirements_occurs_in_samples_filtered: 'Förekommer i {count} stickprov',
        audit_status_failed: 'Underkänt',
        undefined_description: 'Beskrivning'
    };
    return {
        t: (key: string, opts?: Record<string, unknown>) => {
            let s = map[key] ?? key;
            if (opts) {
                Object.entries(opts).forEach(([k, v]) => {
                    s = s.replace(`{${k}}`, String(v));
                });
            }
            return s;
        }
    };
}

describe('create_all_requirement_list_item brist-id på stickprov', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('visar endast stickprov som har det sökta brist-id:t', () => {
        const relevant = new Map([
            ['sp1', new Set(['req-b'])],
            ['sp2', new Set(['req-b'])]
        ]);
        const li = create_all_requirement_list_item(
            'req-b',
            req_b,
            [sample_with_b27, sample_without_b27],
            { deficiency_search_number: 27, has_active_filter: true },
            relevant,
            {},
            () => ({}),
            {},
            minimal_helpers(),
            minimal_translation()
        );
        const sample_items = li.querySelectorAll('ol.requirement-samples-list > li.requirement-sample-item');
        expect(sample_items.length).toBe(1);
        expect(sample_items[0].textContent).toContain('Med brist 27');
    });

    test('utan brist-id-filter visas båda stickprov', () => {
        const relevant = new Map([
            ['sp1', new Set(['req-b'])],
            ['sp2', new Set(['req-b'])]
        ]);
        const li = create_all_requirement_list_item(
            'req-b',
            req_b,
            [sample_with_b27, sample_without_b27],
            { deficiency_search_number: null },
            relevant,
            {},
            () => ({}),
            {},
            minimal_helpers(),
            minimal_translation()
        );
        const sample_items = li.querySelectorAll('ol.requirement-samples-list > li.requirement-sample-item');
        expect(sample_items.length).toBe(2);
    });
});
