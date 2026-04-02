/**
 * Tester för att debouncad autospar i observationsfält inte höjer lastStatusUpdate
 * (skipLastStatusBump) medan blur-commit använder full bump.
 */
import { jest } from '@jest/globals';
import { RequirementAuditComponent } from '../../js/components/RequirementAuditComponent.js';

describe('RequirementAuditComponent dispatch_result_update skipLastStatusBump', () => {
    test('behåller lastStatusUpdate från store när skipLastStatusBump är true', () => {
        const frozen_ts = '2020-06-01T12:00:00.000Z';
        const comp = new RequirementAuditComponent();
        comp.params = { sampleId: '1', requirementId: 'req1' };
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
