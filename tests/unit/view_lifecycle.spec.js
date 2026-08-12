/**
 * Tester för vybyteslivscykel (destroy, kravvy-navigering).
 */

import { describe, test, expect, jest } from '@jest/globals';
import {
    destroy_previous_view_component,
    is_requirement_audit_core_param_change,
    requirement_audit_core_route_params
} from '../../js/view/view_lifecycle.js';

describe('view_lifecycle', () => {
    test('requirement_audit_core_route_params plockar sampleId och requirementId', () => {
        expect(requirement_audit_core_route_params({
            sampleId: 's1',
            requirementId: 'r1',
            rasM: 'sr',
            auditId: '42'
        })).toEqual({ sampleId: 's1', requirementId: 'r1' });
    });

    test('is_requirement_audit_core_param_change när krav ändras', () => {
        const component = { render: jest.fn() };
        expect(is_requirement_audit_core_param_change({
            prev_view: 'requirement_audit',
            view_name: 'requirement_audit',
            prev_params: { sampleId: 's1', requirementId: 'a', rasM: 'sr' },
            params: { sampleId: 's1', requirementId: 'b' },
            current_view_component_instance: component,
            requirement_audit_component: component
        })).toBe(true);
    });

    test('is_requirement_audit_core_param_change är falskt när kärnparametrar är oförändrade', () => {
        const component = { render: jest.fn() };
        expect(is_requirement_audit_core_param_change({
            prev_view: 'requirement_audit',
            view_name: 'requirement_audit',
            prev_params: { sampleId: 's1', requirementId: 'r1', rasM: 'sr' },
            params: { sampleId: 's1', requirementId: 'r1', rasSQ: 'sök' },
            current_view_component_instance: component,
            requirement_audit_component: component
        })).toBe(false);
    });

    test('destroy_previous_view_component väntar på async destroy', async () => {
        let destroyed = false;
        const instance = {
            destroy: jest.fn(async () => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                destroyed = true;
            })
        };

        await destroy_previous_view_component({
            current_view_component_instance: instance,
            notificationComponent: null,
            requirementListComponent: null,
            view_name_to_render: 'requirement_audit',
            error_boundary_holder: { instance: null },
            render_ctx: { current_view_name_rendered: 'requirement_audit' },
            consoleManager: { warn: jest.fn(), error: jest.fn() }
        });

        expect(instance.destroy).toHaveBeenCalled();
        expect(destroyed).toBe(true);
    });
});
