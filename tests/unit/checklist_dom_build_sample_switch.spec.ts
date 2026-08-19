/**
 * @fileoverview Testar att ChecklistHandler bygger om DOM och håller observationer isolerade vid byte av sample.
 */

import { ChecklistHandler } from '../../js/components/requirement_audit/ChecklistHandler.js';

describe('ChecklistHandler DOM rebuild vid byte av sample', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        ChecklistHandler.init(
            container,
            {
                onStatusChange: () => {},
                onObservationChange: () => {},
                onObservationChangeImmediate: () => {},
                onObservationBlurCommit: () => {}
            },
            {
                deps: {
                    Helpers: {
                        create_element: (tag: string, opts: { class_name?: string | string[]; text_content?: string; attributes?: Record<string, string> } = {}) => {
                            const el = document.createElement(tag);
                            if (opts.class_name) {
                                el.className = Array.isArray(opts.class_name) ? opts.class_name.join(' ') : opts.class_name;
                            }
                            if (opts.text_content) el.textContent = opts.text_content;
                            if (opts.attributes) {
                                for (const [k, v] of Object.entries(opts.attributes)) el.setAttribute(k, v);
                            }
                            return el;
                        },
                        escape_html: (s: string) => s,
                        safe_parse_markdown_inline: (s: string) => s,
                        init_auto_resize_for_textarea: () => {}
                    },
                    Translation: {
                        t: (k: string) => k,
                        get_current_language_code: () => 'sv-SE'
                    }
                }
            }
        );
    });

    afterEach(() => {
        ChecklistHandler.destroy();
        container.remove();
    });

    test('is_dom_built sätts till false och DOM byggs om när sampleId ändras', () => {
        let current_sample_id = 'sample-1';
        ChecklistHandler.get_sample_id = () => current_sample_id;

        const requirement_definition = {
            id: 'req-1',
            checks: [{
                id: 'check-1',
                passCriteria: [{
                    id: 'pc-1',
                    failureStatementTemplate: 'Mall text'
                }]
            }]
        };

        const sample_1_result = {
            checkResults: {
                'check-1': {
                    overallStatus: 'failed',
                    passCriteria: {
                        'pc-1': {
                            status: 'failed',
                            observationDetail: 'Observation på startsidan (sample 1)'
                        }
                    }
                }
            }
        };

        const sample_2_result = {
            checkResults: {
                'check-1': {
                    overallStatus: 'failed',
                    passCriteria: {
                        'pc-1': {
                            status: 'failed',
                            observationDetail: ''
                        }
                    }
                }
            }
        };

        // 1. Rendera sample 1
        ChecklistHandler.render(requirement_definition, sample_1_result, false, null, null);
        expect(ChecklistHandler.is_dom_built).toBe(true);

        const textarea1 = container.querySelector('textarea.pc-observation-detail-textarea') as HTMLTextAreaElement;
        expect(textarea1).not.toBeNull();
        expect(textarea1.value).toBe('Observation på startsidan (sample 1)');

        // 2. Byt till sample 2 under samma krav
        current_sample_id = 'sample-2';
        ChecklistHandler.render(requirement_definition, sample_2_result, false, null, null);

        // DOM ska ha byggts om med en ny textarea som har tomt värde
        const textarea2 = container.querySelector('textarea.pc-observation-detail-textarea') as HTMLTextAreaElement;
        expect(textarea2).not.toBeNull();
        expect(textarea2.value).toBe('');

        // Sample 2:s data i minnet ska förbli orörd och inte ha förorenats av sample 1
        expect(sample_2_result.checkResults['check-1'].passCriteria['pc-1'].observationDetail).toBe('');
    });
});
