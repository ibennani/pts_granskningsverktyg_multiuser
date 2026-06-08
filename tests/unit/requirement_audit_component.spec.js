/**
 * @fileoverview Enhetstester för RequirementAuditComponent (singleton / återinit).
 */

import { RequirementAuditComponent } from '../../js/components/RequirementAuditComponent.ts';
import {
    clear_unload_persist_hooks_for_testing,
    register_unload_persist_hook
} from '../../js/logic/unload_persist_registry.ts';

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
});
