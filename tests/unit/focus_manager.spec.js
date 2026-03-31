import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
describe('focus_manager', () => {
    beforeEach(() => {
        jest.resetModules();
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
        delete window.__gv_get_restore_position;
    });

    test('load_focus_storage() returnerar {} om sessionStorage är tomt', async () => {
        const { load_focus_storage } = await import('../../js/logic/focus_manager.js');
        expect(load_focus_storage()).toEqual({});
    });

    test('save_focus_storage() sparar korrekt till sessionStorage', async () => {
        const { load_focus_storage, save_focus_storage } = await import('../../js/logic/focus_manager.js');
        const data = { 'start:{}': { elementId: 'foo' } };
        save_focus_storage(data);
        expect(load_focus_storage()).toEqual(data);
    });

    test('update_restore_position() uppdaterar state korrekt', async () => {
        const { update_restore_position } = await import('../../js/logic/focus_manager.js');

        update_restore_position('metadata', { caseNumber: 'A1' }, { elementId: 'actorName' });

        expect(typeof window.__gv_get_restore_position).toBe('function');
        const st = window.__gv_get_restore_position();
        expect(st.view).toBe('metadata');
        expect(st.params).toEqual({ caseNumber: 'A1' });
        expect(st.focusInfo).toEqual({ elementId: 'actorName' });

        update_restore_position('start', {}, null);
        const st2 = window.__gv_get_restore_position();
        expect(st2.view).toBe('start');
        expect(st2.params).toEqual({});
        expect(st2.focusInfo).toEqual({ elementId: 'actorName' });
    });
});
