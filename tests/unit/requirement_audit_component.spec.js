/**
 * @fileoverview Enhetstester för RequirementAuditComponent (singleton / återinit).
 */

import { RequirementAuditComponent } from '../../js/components/RequirementAuditComponent.ts';
import {
    clear_unload_persist_hooks_for_testing,
    register_unload_persist_hook
} from '../../js/logic/unload_persist_registry.ts';
import {
    calculate_check_status,
    calculate_requirement_status,
    get_ordered_relevant_requirement_keys,
    get_stored_requirement_result_for_def,
    requirement_results_equal_for_last_updated
} from '../../js/audit_logic.js';

describe('RequirementAuditComponent', () => {
    afterEach(() => {
        clear_unload_persist_hooks_for_testing();
    });

    it('kan binda unload-persist efter att destroy satt fältet till null', () => {
        const component = new RequirementAuditComponent();
        component._handle_unload_persist = null;

        component._handle_unload_persist = RequirementAuditComponent.prototype._handle_unload_persist.bind(component);
        register_unload_persist_hook('requirement_audit_plate', component._handle_unload_persist);

        expect(typeof component._handle_unload_persist).toBe('function');
        expect(() => component._handle_unload_persist('pagehide')).not.toThrow();
    });

    it('load_and_prepare_view_data hittar resultat lagrat under publik nyckel när map-nyckel skiljer sig', () => {
        const comp = new RequirementAuditComponent();
        comp.params = { sampleId: 's1', requirementId: 'pub_k' };
        comp.AuditLogic = {
            get_stored_requirement_result_for_def,
            calculate_check_status,
            calculate_requirement_status,
            requirement_results_equal_for_last_updated,
            get_ordered_relevant_requirement_keys
        };
        comp.getState = () => ({
            ruleFileContent: {
                requirements: {
                    key_map_only: {
                        key: 'pub_k',
                        id: 'pub_k',
                        title: 'Testkrav',
                        checks: [{
                            id: 'c1',
                            passCriteria: [{ id: 'pc1' }],
                            logic: 'AND'
                        }]
                    }
                }
            },
            samples: [{
                id: 's1',
                requirementResults: {
                    pub_k: {
                        status: 'passed',
                        commentToActor: 'Min kommentar',
                        checkResults: {
                            c1: {
                                overallStatus: 'passed',
                                passCriteria: { pc1: { status: 'passed' } }
                            }
                        }
                    }
                }
            }]
        });

        const ok = comp.load_and_prepare_view_data();

        expect(ok).toBe(true);
        expect(comp.requirement_map_key).toBe('key_map_only');
        expect(comp.current_result.status).toBe('passed');
        expect(comp.current_result.commentToActor).toBe('Min kommentar');
        expect(comp.AuditLogic.calculate_requirement_status(
            comp.current_requirement,
            comp.current_result
        )).toBe('passed');
    });
});
