import { jest, describe, test, expect, beforeEach } from '@jest/globals';

describe('RulefileRequirementsListComponent state-uppdatering', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('handle_state_update respekterar skip_render', async () => {
        const { RulefileRequirementsListComponent } = await import('../../js/components/RulefileRequirementsListComponent.js');
        const comp = new RulefileRequirementsListComponent();
        comp.is_dom_initialized = true;
        comp._populate_dynamic_content = jest.fn();

        comp.handle_state_update({}, { skip_render: true, action_type: 'UPDATE_RULEFILE_CONTENT' });
        expect(comp._populate_dynamic_content).not.toHaveBeenCalled();
    });

    test('handle_state_update ignorerar UPDATE_REQUIREMENT_RESULT', async () => {
        const { RulefileRequirementsListComponent } = await import('../../js/components/RulefileRequirementsListComponent.js');
        const comp = new RulefileRequirementsListComponent();
        comp.is_dom_initialized = true;
        comp._populate_dynamic_content = jest.fn();

        comp.handle_state_update({}, { action_type: 'UPDATE_REQUIREMENT_RESULT' });
        expect(comp._populate_dynamic_content).not.toHaveBeenCalled();
    });

    test('handle_state_update repopulerar vid filterändring', async () => {
        const { RulefileRequirementsListComponent } = await import('../../js/components/RulefileRequirementsListComponent.js');
        const comp = new RulefileRequirementsListComponent();
        comp.is_dom_initialized = true;
        comp._populate_dynamic_content = jest.fn();

        comp.handle_state_update({}, { action_type: 'SET_UI_FILTER_SETTINGS' });
        expect(comp._populate_dynamic_content).toHaveBeenCalled();
    });
});
