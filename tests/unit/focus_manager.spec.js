/**
 * Tester för focus_manager.js
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

describe('focus_manager', () => {
    beforeEach(() => {
        jest.resetModules();
        sessionStorage.clear();
        document.body.innerHTML = '';
        delete window.__gv_restore_focus_info;
        delete window.customFocusApplied;
        delete window.__gv_get_restore_position;
    });

    afterEach(() => {
        sessionStorage.clear();
        document.body.innerHTML = '';
        delete window.__gv_restore_focus_info;
        delete window.customFocusApplied;
        jest.useRealTimers();
    });

    test('load_focus_storage returnerar {} om sessionStorage är tomt', async () => {
        const { load_focus_storage } = await import('../../js/logic/focus_manager.js');
        expect(load_focus_storage()).toEqual({});
    });

    test('load_focus_storage hanterar ogiltig JSON', async () => {
        sessionStorage.setItem('gv_focus_by_scope_v1', '{not-json');
        const { load_focus_storage } = await import('../../js/logic/focus_manager.js');
        expect(load_focus_storage()).toEqual({});
    });

    test('save_focus_storage och load_focus_storage roundtrip', async () => {
        const { load_focus_storage, save_focus_storage } = await import('../../js/logic/focus_manager.js');
        const data = { 'metadata:{}': { elementId: 'foo' } };
        save_focus_storage(data);
        expect(load_focus_storage()).toEqual(data);
    });

    test('update_restore_position uppdaterar vy och behåller focusInfo vid null', async () => {
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

    test('capture_focus_info_from_element: id inom root', async () => {
        const { capture_focus_info_from_element } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const inp = document.createElement('input');
        inp.id = 'x1';
        root.appendChild(inp);
        expect(capture_focus_info_from_element(inp, root)).toEqual({
            elementId: 'x1',
            elementName: null,
            dataIndex: null
        });
    });

    test('capture_focus_info_from_element: name och data-index', async () => {
        const { capture_focus_info_from_element } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const inp = document.createElement('input');
        inp.setAttribute('name', 'f1');
        inp.setAttribute('data-index', '2');
        root.appendChild(inp);
        expect(capture_focus_info_from_element(inp, root)).toEqual({
            elementId: null,
            elementName: 'f1',
            dataIndex: '2'
        });
    });

    test('capture_focus_info_from_element: null om element utanför root', async () => {
        const { capture_focus_info_from_element } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const outer = document.createElement('input');
        expect(capture_focus_info_from_element(outer, root)).toBeNull();
    });

    test('apply_restore_focus_instruction fokuserar via elementId', async () => {
        jest.useFakeTimers();
        const { apply_restore_focus_instruction } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const inp = document.createElement('input');
        inp.id = 'focus-me';
        root.appendChild(inp);
        document.body.appendChild(root);
        window.__gv_restore_focus_info = { elementId: 'focus-me' };
        const focus_spy = jest.spyOn(inp, 'focus');

        const result = apply_restore_focus_instruction({ view_root: root });
        expect(result).toBe(true);
        await jest.advanceTimersByTimeAsync(250);
        expect(focus_spy).toHaveBeenCalled();
        expect(window.__gv_restore_focus_info).toBeNull();
        focus_spy.mockRestore();
    });

    test('apply_post_render_focus_instruction: false utan restore-info och fel vy', async () => {
        const { apply_post_render_focus_instruction } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        expect(apply_post_render_focus_instruction({ view_name: 'start', view_root: root })).toBe(false);
    });

    test('apply_post_render_focus_instruction: audit_overview med sessionStorage-instruktion', async () => {
        jest.useFakeTimers();
        sessionStorage.setItem('gv_return_focus_audit_info_h2_v1', JSON.stringify({ focus: 'audit_info_h2' }));
        const { apply_post_render_focus_instruction } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const h2 = document.createElement('h2');
        h2.id = 'audit-info-heading';
        root.appendChild(h2);
        document.body.appendChild(root);

        const top = document.createElement('div');
        top.id = 'global-action-bar-top';
        Object.defineProperty(top, 'offsetHeight', { value: 40, configurable: true });
        document.body.appendChild(top);

        const scroll_spy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
        const focus_spy = jest.spyOn(h2, 'focus').mockImplementation(() => {});

        const ok = apply_post_render_focus_instruction({ view_name: 'audit_overview', view_root: root });
        expect(ok).toBe(true);
        await jest.advanceTimersByTimeAsync(10);
        expect(focus_spy).toHaveBeenCalled();
        scroll_spy.mockRestore();
        focus_spy.mockRestore();
    });
});
