/**
 * Tester för att debouncad lagring till Redux från observationsfält inte höjer lastStatusUpdate
 * (skipLastStatusBump) medan omedelbar commit använder full bump.
 */
import { jest } from '@jest/globals';
import { RequirementAuditComponent } from '../../js/components/RequirementAuditComponent.js';

describe('RequirementAuditComponent dispatch_result_update skipLastStatusBump', () => {
    test('behåller lastStatusUpdate från store när skipLastStatusBump är true', () => {
        const frozen_ts = '2020-06-01T12:00:00.000Z';
        const comp = new RequirementAuditComponent();
        comp.params = { sampleId: '1', requirementId: 'req1' };
        comp.requirement_map_key = 'req1';
        comp.getState = () => ({
            samples: [{
                id: '1',
                requirementResults: {
                    req1: {
                        lastStatusUpdate: frozen_ts,
                        lastStatusUpdateBy: 'Anna',
                        checkResults: {}
                    }
                }
            }]
        });
        comp.current_requirement = { checks: [] };
        comp.AuditLogic = {
            calculate_check_status: () => 'passed',
            calculate_requirement_status: () => 'passed',
            requirement_results_equal_for_last_updated: () => false
        };
        comp.Helpers = { get_current_iso_datetime_utc: () => '2025-12-01T00:00:00.000Z' };
        comp.StoreActionTypes = { UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT' };
        comp.dispatch = jest.fn();

        const modified = {
            lastStatusUpdate: null,
            lastStatusUpdateBy: null,
            checkResults: {}
        };
        comp.dispatch_result_update(modified, { skipLastStatusBump: true });

        expect(comp.dispatch).toHaveBeenCalledTimes(1);
        const payload = comp.dispatch.mock.calls[0][0].payload.newRequirementResult;
        expect(payload.lastStatusUpdate).toBe(frozen_ts);
        expect(payload.lastStatusUpdateBy).toBe('Anna');
    });

    test('sätter ny lastStatusUpdate när skipLastStatusBump är false', () => {
        const comp = new RequirementAuditComponent();
        comp.params = { sampleId: '1', requirementId: 'req1' };
        comp.requirement_map_key = 'req1';
        comp.getState = () => ({
            samples: [{
                id: '1',
                requirementResults: {
                    req1: {
                        lastStatusUpdate: '2020-06-01T12:00:00.000Z',
                        lastStatusUpdateBy: 'Anna',
                        checkResults: {}
                    }
                }
            }]
        });
        comp.current_requirement = { checks: [] };
        comp.AuditLogic = {
            calculate_check_status: () => 'passed',
            calculate_requirement_status: () => 'passed',
            requirement_results_equal_for_last_updated: () => false
        };
        const new_ts = '2025-12-01T00:00:00.000Z';
        comp.Helpers = { get_current_iso_datetime_utc: () => new_ts };
        comp.StoreActionTypes = { UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT' };
        comp.dispatch = jest.fn();

        const modified = {
            lastStatusUpdate: null,
            lastStatusUpdateBy: null,
            checkResults: {}
        };
        comp.dispatch_result_update(modified, { skipLastStatusBump: false });

        const payload = comp.dispatch.mock.calls[0][0].payload.newRequirementResult;
        expect(payload.lastStatusUpdate).toBe(new_ts);
        expect(payload.lastStatusUpdateBy).toBeDefined();
    });
});

describe('RequirementAuditComponent plate text autosave', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('debouncar sparning till store 250 ms efter input', () => {
        const comp = new RequirementAuditComponent();
        comp.plate_element_ref = document.createElement('div');
        comp.current_result = { checkResults: {}, commentToAuditor: '', commentToActor: '' };
        comp.handle_comment_input = jest.fn();
        comp.checklist_handler_instance = { flush_observations_before_destroy: jest.fn() };
        comp.save_requirement_result_spar_bakgrund = jest.fn();

        comp._request_plate_text_autosave();
        expect(comp.save_requirement_result_spar_bakgrund).not.toHaveBeenCalled();

        jest.advanceTimersByTime(250);
        expect(comp.handle_comment_input).toHaveBeenCalledWith(false);
        expect(comp.checklist_handler_instance.flush_observations_before_destroy).toHaveBeenCalledWith({ trim: false });
        expect(comp.save_requirement_result_spar_bakgrund).toHaveBeenCalledWith({ skipLastStatusBump: true });
    });

    test('flush vid unload sparar direkt utan debounce (synkront)', () => {
        const comp = new RequirementAuditComponent();
        comp.plate_element_ref = document.createElement('div');
        comp.current_result = { checkResults: {} };
        comp._plate_text_autosave_timer = setTimeout(() => {}, 5000);
        comp.handle_comment_input = jest.fn();
        comp.checklist_handler_instance = { flush_observations_before_destroy: jest.fn() };
        comp._persist_current_result_to_store = jest.fn().mockReturnValue(true);

        comp._flush_plate_text_autosave_for_unload();

        expect(comp._plate_text_autosave_timer).toBeNull();
        expect(comp.handle_comment_input).toHaveBeenCalledWith(false);
        expect(comp.checklist_handler_instance.flush_observations_before_destroy).toHaveBeenCalledWith({ trim: false });
        expect(comp._persist_current_result_to_store).toHaveBeenCalledWith({
            skip_last_status_bump: true,
            sync_persist: true
        });
    });
});
