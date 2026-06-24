import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { prepare_deficiency_observation_focus_before_audit_navigation } from '../../js/components/requirements_list/requirement_list_audit_navigation.js';
import { reapply_pending_status_button_focus } from '../../js/components/requirement_audit/checklist_status_button_ui.js';

describe('prepare_deficiency_observation_focus_before_audit_navigation', () => {
    beforeEach(() => {
        window.__gv_pending_checklist_focus_target = undefined;
    });

    afterEach(() => {
        delete window.__gv_pending_checklist_focus_target;
    });

    test('sätter väntande fokus på bristbeskrivning vid brist-id-sökning', () => {
        prepare_deficiency_observation_focus_before_audit_navigation({
            getState: () => ({
                auditStatus: 'locked',
                uiSettings: {
                    allRequirementsFilter: { searchText: '27' }
                },
                samples: [{
                    id: 'sp1',
                    requirementResults: {
                        'req-b': {
                            checkResults: {
                                c1: {
                                    passCriteria: {
                                        p1: { status: 'failed', deficiencyId: 'B27' }
                                    }
                                }
                            }
                        }
                    }
                }],
                ruleFileContent: {
                    requirements: {
                        'req-b': { id: 'req-b', key: 'req-b', title: 'Krav' }
                    }
                }
            }),
            state_filter_key: 'allRequirementsFilter',
            sample_id: 'sp1',
            requirement_id: 'req-b'
        });

        expect(window.__gv_pending_checklist_focus_target).toEqual(expect.objectContaining({
            action: 'focus_observation',
            check_id: 'c1',
            pc_id: 'p1'
        }));
    });

    test('sätter inte fokus vid vanlig textsökning', () => {
        prepare_deficiency_observation_focus_before_audit_navigation({
            getState: () => ({
                auditStatus: 'locked',
                uiSettings: {
                    allRequirementsFilter: { searchText: 'kontrast' }
                },
                samples: [],
                ruleFileContent: { requirements: {} }
            }),
            state_filter_key: 'allRequirementsFilter',
            sample_id: 'sp1',
            requirement_id: 'req-b'
        });

        expect(window.__gv_pending_checklist_focus_target).toBeUndefined();
    });
});

describe('reapply_pending_status_button_focus focus_observation', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        window.__gv_pending_checklist_focus_target = undefined;
        window.customFocusApplied = false;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.__gv_pending_checklist_focus_target;
        delete window.customFocusApplied;
    });

    test('fokuserar rätt bristbeskrivning och rensar väntande mål', () => {
        jest.useFakeTimers();
        const container = document.createElement('div');
        const textarea = document.createElement('textarea');
        textarea.id = 'pc-observation-c1-p1';
        textarea.className = 'pc-observation-detail-textarea';
        container.appendChild(textarea);
        document.body.appendChild(container);

        window.__gv_pending_checklist_focus_target = {
            action: 'focus_observation',
            check_id: 'c1',
            pc_id: 'p1',
            set_at: Date.now()
        };

        reapply_pending_status_button_focus({ container_ref: container });
        jest.runAllTimers();

        expect(document.activeElement).toBe(textarea);
        expect(window.__gv_pending_checklist_focus_target).toBeUndefined();
        expect(window.customFocusApplied).toBe(true);
        jest.useRealTimers();
    });
});
