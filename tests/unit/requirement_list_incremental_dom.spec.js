/**
 * Tester för inkrementell DOM-uppdatering i kravlistor.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';

describe('requirement_list_incremental_dom', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('sync_requirement_mark_all_passed_button tar bort knappen när inga ogranskade kvar', async () => {
        const { sync_requirement_mark_all_passed_button } = await import(
            '../../js/components/requirements_list/requirement_list_incremental_dom.js'
        );

        const li = document.createElement('li');
        li.className = 'requirement-item-with-actions';
        li.innerHTML = '<button data-action="mark-requirement-passed-all" data-requirement-id="req-1">Markera</button>';

        const Helpers = {
            create_element: (tag, opts = {}) => {
                const el = document.createElement(tag);
                if (opts.class_name) {
                    el.className = Array.isArray(opts.class_name) ? opts.class_name.join(' ') : opts.class_name;
                }
                if (opts.text_content) el.textContent = opts.text_content;
                if (opts.attributes) {
                    Object.entries(opts.attributes).forEach(([k, v]) => el.setAttribute(k, String(v)));
                }
                return el;
            }
        };
        const Translation = { t: (key) => key };

        sync_requirement_mark_all_passed_button(
            li,
            'req-1',
            { key: 'req-1', title: 'Testkrav' },
            [{
                id: 's1',
                requirementResults: {
                    'req-1': { status: 'passed', checkResults: {} }
                }
            }],
            new Map([['s1', new Set(['req-1'])]]),
            { 'req-1': { key: 'req-1', checks: [] } },
            'in_progress',
            { Helpers, Translation }
        );

        expect(li.querySelector('button[data-action="mark-requirement-passed-all"]')).toBeNull();
    });
});
