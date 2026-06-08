/**
 * Verifierar att snabba checklist-statusändringar serialiseras så inget klick skrivs över.
 */
import { jest } from '@jest/globals';
import { RequirementAuditComponent } from '../../js/components/RequirementAuditComponent.js';

function build_initial_result() {
    return {
        status: 'not_audited',
        commentToAuditor: '',
        commentToActor: '',
        lastStatusUpdate: null,
        stuckProblemDescription: '',
        checkResults: {
            check_a: {
                status: 'not_audited',
                overallStatus: 'not_audited',
                passCriteria: {}
            },
            check_b: {
                status: 'not_audited',
                overallStatus: 'not_audited',
                passCriteria: {}
            }
        }
    };
}

function build_mock_store(result) {
    return {
        auditStatus: 'in_progress',
        ruleFileContent: {
            requirements: {
                req1: { key: 'req1', title: 'Krav 1', checks: [] }
            }
        },
        samples: [{
            id: 'sample-1',
            requirementResults: { req1: result }
        }]
    };
}

function setup_component_for_status_queue() {
    const comp = new RequirementAuditComponent();
    let store = build_mock_store(build_initial_result());

    comp.params = { sampleId: 'sample-1', requirementId: 'req1' };
    comp.requirement_map_key = 'req1';
    comp.requirement_public_key = 'req1';
    comp.current_requirement = {
        key: 'req1',
        title: 'Krav 1',
        checks: [
            { id: 'check_a', key: 'check_a', passCriteria: [] },
            { id: 'check_b', key: 'check_b', passCriteria: [] }
        ]
    };
    comp.current_result = build_initial_result();
    comp.current_sample = store.samples[0];
    comp.Helpers = { get_current_iso_datetime_utc: () => '2026-05-15T10:00:00.000Z' };
    comp.StoreActionTypes = { UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT' };
    comp.NotificationComponent = { show_global_message: jest.fn(), clear_global_message: jest.fn() };
    comp.Translation = { t: (key) => key };
    comp.AuditLogic = {
        calculate_check_status: (_def, _pc, overall) => overall || 'not_audited',
        calculate_requirement_status: () => 'in_progress',
        requirement_results_equal_for_last_updated: () => false,
        get_ordered_relevant_requirement_keys: () => ['req1']
    };
    comp.getState = () => store;
    comp.load_and_prepare_view_data = jest.fn(() => {
        const from_store = store.samples[0].requirementResults.req1;
        comp.current_result = JSON.parse(JSON.stringify(from_store));
        comp.current_sample = store.samples[0];
        return true;
    });
    comp._refresh_plate_ui_after_result_sync_from_store = jest.fn(async () => {});
    comp.render = jest.fn(async () => {});

    comp.dispatch = jest.fn((action) => new Promise((resolve) => {
        setTimeout(() => {
            store = {
                ...store,
                samples: store.samples.map((sample) => (
                    String(sample.id) === String(action.payload.sampleId)
                        ? {
                            ...sample,
                            requirementResults: {
                                ...(sample.requirementResults || {}),
                                [action.payload.requirementId]: action.payload.newRequirementResult
                            }
                        }
                        : sample
                ))
            };
            resolve();
        }, 15);
    }));

    return { comp, get_store: () => store };
}

describe('RequirementAuditComponent handle_checklist_status_change serialisering', () => {
    test('behåller båda snabba statusändringar i store', async () => {
        const { comp, get_store } = setup_component_for_status_queue();

        const change_a = {
            type: 'check_overall_status_change',
            checkId: 'check_a',
            newStatus: 'passed'
        };
        const change_b = {
            type: 'check_overall_status_change',
            checkId: 'check_b',
            newStatus: 'passed'
        };

        const first = comp.handle_checklist_status_change(change_a);
        const second = comp.handle_checklist_status_change(change_b);
        await Promise.all([first, second]);

        expect(comp.dispatch).toHaveBeenCalledTimes(2);

        const final_result = get_store().samples[0].requirementResults.req1;
        expect(final_result.checkResults.check_a.overallStatus).toBe('passed');
        expect(final_result.checkResults.check_b.overallStatus).toBe('passed');

        const second_payload = comp.dispatch.mock.calls[1][0].payload.newRequirementResult;
        expect(second_payload.checkResults.check_a.overallStatus).toBe('passed');
        expect(second_payload.checkResults.check_b.overallStatus).toBe('passed');
    });

    test('destroy väntar på pågående statusändring innan sparning', async () => {
        const { comp } = setup_component_for_status_queue();
        let resolve_dispatch;
        comp.dispatch = jest.fn(() => new Promise((resolve) => {
            resolve_dispatch = resolve;
        }));
        comp._save_plate_to_redux = jest.fn();

        const change = {
            type: 'check_overall_status_change',
            checkId: 'check_a',
            newStatus: 'passed'
        };

        let destroy_completed = false;
        const status_promise = comp.handle_checklist_status_change(change);
        const destroy_promise = comp.destroy().then(() => {
            destroy_completed = true;
        });

        await new Promise((r) => setTimeout(r, 5));
        expect(destroy_completed).toBe(false);

        resolve_dispatch();
        await Promise.all([status_promise, destroy_promise]);

        expect(destroy_completed).toBe(true);
        expect(comp._save_plate_to_redux).toHaveBeenCalled();
    });
});
