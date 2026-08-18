/**
 * Verifierar att ChecklistHandler inte skriver över användartext med malltext vid UI-synk.
 */
import { jest } from '@jest/globals';
import { ChecklistHandler } from '../../js/components/requirement_audit/ChecklistHandler.js';

describe('ChecklistHandler observationstext-synk', () => {
    test('hämtar sparad observationDetail för aktuellt sample', () => {
        const handler = ChecklistHandler;
        handler.requirement_result_ref = {
            checkResults: {
                '1': {
                    overallStatus: 'passed',
                    passCriteria: {
                        '1.1': {
                            status: 'failed',
                            observationDetail: 'Sparad observation för detta sample'
                        }
                    }
                }
            }
        };
        handler.requirement_definition_ref = {
            checks: [{
                id: '1',
                passCriteria: [{
                    id: '1.1',
                    failureStatementTemplate: 'Malltext från regelfilen'
                }]
            }]
        };

        const textarea = document.createElement('textarea');
        textarea.value = 'Gammal text från föregående sample';

        const target = handler._resolve_observation_target_for_textarea(
            '1',
            '1.1',
            { status: 'failed', observationDetail: 'Sparad observation för detta sample' },
            'passed',
            textarea
        );

        expect(target).toBe('Sparad observation för detta sample');

        const should_sync = handler._should_apply_observation_textarea_sync(
            textarea,
            target,
            true,
            'passed',
            'failed',
            '1',
            '1.1'
        );

        expect(should_sync).toBe(true);
        handler._sync_observation_textarea_from_target(textarea, target, '1', '1.1');
        expect(textarea.value).toBe('Sparad observation för detta sample');
    });

    test('skriver inte över sample 2 med text från sample 1 vid byte av granskningsdel', () => {
        const handler = ChecklistHandler;
        handler.Translation = { t: (k) => k };
        handler.Helpers = {
            create_element: (tag, opts = {}) => {
                const el = document.createElement(tag);
                if (opts.class_name) el.className = Array.isArray(opts.class_name) ? opts.class_name.join(' ') : opts.class_name;
                if (opts.text_content) el.textContent = opts.text_content;
                if (opts.attributes) {
                    for (const [k, v] of Object.entries(opts.attributes)) el.setAttribute(k, v);
                }
                return el;
            }
        };
        handler.last_sample_id = 'sample-1';
        handler.get_sample_id = () => 'sample-2';

        handler.requirement_result_ref = {
            checkResults: {
                '1': {
                    overallStatus: 'passed',
                    passCriteria: {
                        '1.1': {
                            status: 'failed',
                            observationDetail: ''
                        }
                    }
                }
            }
        };
        handler.requirement_definition_ref = {
            checks: [{
                id: '1',
                passCriteria: [{
                    id: '1.1',
                    failureStatementTemplate: 'Standardmall'
                }]
            }]
        };

        const textarea = document.createElement('textarea');
        textarea.value = 'Text från sample 1';

        // Vid byte till sample 2 ska transient cache rensas och målvärdet vara sample 2:s data (malltext eller tom)
        handler.render(handler.requirement_definition_ref, handler.requirement_result_ref, false, null, null);

        const target = handler._resolve_observation_target_for_textarea(
            '1',
            '1.1',
            { status: 'failed', observationDetail: '' },
            'passed',
            textarea
        );

        expect(target).toBe('Standardmall');

        const should_sync = handler._should_apply_observation_textarea_sync(
            textarea,
            target,
            true,
            'passed',
            'failed',
            '1',
            '1.1'
        );

        expect(should_sync).toBe(true);
        handler._sync_observation_textarea_from_target(textarea, target, '1', '1.1');
        expect(textarea.value).toBe('Standardmall');
        expect(handler.requirement_result_ref.checkResults['1'].passCriteria['1.1'].observationDetail).toBe('Standardmall');
    });

    test('flush vid pointerdown sparar fokuserad textarea innan blur', () => {
        const handler = ChecklistHandler;
        const drafts = new Map();
        handler.requirement_result_ref = {
            checkResults: {
                check_a: {
                    overallStatus: 'passed',
                    passCriteria: {
                        pc_1: {
                            status: 'failed',
                            observationDetail: 'Malltext'
                        }
                    }
                }
            }
        };
        handler.on_observation_draft_update_callback = (check_id, pc_id, text) => {
            drafts.set(`${check_id}:${pc_id}`, text);
        };

        const container = document.createElement('div');
        const check_item = document.createElement('div');
        check_item.className = 'check-item';
        check_item.dataset.checkId = 'check_a';
        const pc_item = document.createElement('li');
        pc_item.className = 'pass-criterion-item';
        pc_item.dataset.pcId = 'pc_1';
        const textarea = document.createElement('textarea');
        textarea.className = 'pc-observation-detail-textarea';
        textarea.value = 'Text medan fokus kvar';
        pc_item.appendChild(textarea);
        check_item.appendChild(pc_item);
        container.appendChild(check_item);
        handler.container_ref = container;

        handler._flush_all_observation_textareas_to_memory();

        expect(drafts.get('check_a:pc_1')).toBe('Text medan fokus kvar');
        expect(
            handler.requirement_result_ref.checkResults.check_a.passCriteria.pc_1.observationDetail
        ).toBe('Text medan fokus kvar');
    });

    test('återställer användartext när observationsfältet döljs och visas igen', () => {
        const handler = ChecklistHandler;
        handler._observation_dom_cache = new Map();
        handler._observation_hidden_with_text_keys = new Set();
        handler.requirement_result_ref = {
            checkResults: {
                '1': {
                    overallStatus: 'passed',
                    passCriteria: {
                        '1.1': {
                            status: 'failed',
                            observationDetail: 'Malltext från regelfilen'
                        }
                    }
                }
            }
        };

        const wrapper = document.createElement('div');
        wrapper.className = 'pc-observation-detail-wrapper';
        const textarea = document.createElement('textarea');
        textarea.className = 'pc-observation-detail-textarea';
        textarea.value = 'Min egen text';
        wrapper.appendChild(textarea);

        handler._sync_observation_wrapper_visibility(wrapper, 'passed', { status: 'passed' }, '1', '1.1');
        expect(wrapper.hidden).toBe(true);
        expect(handler._observation_hidden_with_text_keys.has(handler._observation_cache_key('1', '1.1'))).toBe(true);

        textarea.value = '';
        handler._sync_observation_wrapper_visibility(wrapper, 'passed', { status: 'failed' }, '1', '1.1');
        expect(wrapper.hidden).toBe(false);
        expect(textarea.value).toBe('Min egen text');
    });
});
