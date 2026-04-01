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

    test('capture_focus_info_from_element: tabellrad och kolumn', async () => {
        const { capture_focus_info_from_element } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');
        tr.setAttribute('data-row-id', 'r99');
        const td = document.createElement('td');
        const inner = document.createElement('button');
        inner.textContent = 'X';
        td.appendChild(inner);
        tr.appendChild(td);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        root.appendChild(table);
        expect(capture_focus_info_from_element(inner, root)).toEqual({
            tableRowId: 'r99',
            tableColIndex: 0
        });
    });

    test('capture_focus_info_from_element: länk med href och index', async () => {
        const { capture_focus_info_from_element } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const a0 = document.createElement('a');
        a0.href = '#/samma';
        a0.textContent = 'första';
        const a1 = document.createElement('a');
        a1.href = '#/samma';
        a1.textContent = 'andra';
        root.append(a0, a1);
        expect(capture_focus_info_from_element(a1, root)).toMatchObject({
            linkHref: '#/samma',
            linkIndex: 1
        });
    });

    test('capture_focus_info_from_element: knapp med etikett', async () => {
        const { capture_focus_info_from_element } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const b = document.createElement('button');
        b.textContent = '  Spara ändringar  ';
        root.appendChild(b);
        expect(capture_focus_info_from_element(b, root)).toMatchObject({
            buttonTag: 'button',
            buttonLabel: 'Spara ändringar',
            buttonIndex: 0
        });
    });

    test('capture_focus_info_from_element: requirement och sample-id', async () => {
        const { capture_focus_info_from_element } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const el = document.createElement('div');
        el.setAttribute('data-requirement-id', 'req1');
        el.setAttribute('data-sample-id', 'sam1');
        root.appendChild(el);
        expect(capture_focus_info_from_element(el, root)).toEqual({
            requirementId: 'req1',
            sampleId: 'sam1'
        });
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

    test('apply_restore_focus_instruction: elementName', async () => {
        jest.useFakeTimers();
        const { apply_restore_focus_instruction } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const inp = document.createElement('input');
        inp.setAttribute('name', 'f_unik');
        root.appendChild(inp);
        document.body.appendChild(root);
        window.__gv_restore_focus_info = { elementName: 'f_unik' };
        const focus_spy = jest.spyOn(inp, 'focus');
        apply_restore_focus_instruction({ view_root: root });
        await jest.advanceTimersByTimeAsync(250);
        expect(focus_spy).toHaveBeenCalled();
        focus_spy.mockRestore();
    });

    test('apply_restore_focus_instruction: tabellcell med fokuserbart barn', async () => {
        jest.useFakeTimers();
        const { apply_restore_focus_instruction } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');
        tr.setAttribute('data-row-id', 't1');
        const td = document.createElement('td');
        const link = document.createElement('a');
        link.href = '#x';
        link.textContent = 'L';
        td.appendChild(link);
        tr.appendChild(td);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        root.appendChild(table);
        document.body.appendChild(root);
        window.__gv_restore_focus_info = { tableRowId: 't1', tableColIndex: 0 };
        const focus_spy = jest.spyOn(link, 'focus');
        apply_restore_focus_instruction({ view_root: root });
        await jest.advanceTimersByTimeAsync(250);
        expect(focus_spy).toHaveBeenCalled();
        focus_spy.mockRestore();
    });

    test('apply_restore_focus_instruction: länk via href', async () => {
        jest.useFakeTimers();
        const { apply_restore_focus_instruction } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const l = document.createElement('a');
        l.href = '#/uniq';
        l.textContent = 'Q';
        root.appendChild(l);
        document.body.appendChild(root);
        window.__gv_restore_focus_info = { linkHref: '#/uniq', linkIndex: 0 };
        const focus_spy = jest.spyOn(l, 'focus');
        apply_restore_focus_instruction({ view_root: root });
        await jest.advanceTimersByTimeAsync(250);
        expect(focus_spy).toHaveBeenCalled();
        focus_spy.mockRestore();
    });

    test('apply_restore_focus_instruction: knapp via etikett', async () => {
        jest.useFakeTimers();
        const { apply_restore_focus_instruction } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const btn = document.createElement('button');
        btn.textContent = 'Nästa';
        root.appendChild(btn);
        document.body.appendChild(root);
        window.__gv_restore_focus_info = { buttonTag: 'button', buttonLabel: 'Nästa', buttonIndex: 0 };
        const focus_spy = jest.spyOn(btn, 'focus');
        apply_restore_focus_instruction({ view_root: root });
        await jest.advanceTimersByTimeAsync(250);
        expect(focus_spy).toHaveBeenCalled();
        focus_spy.mockRestore();
    });

    test('apply_restore_focus_instruction: requirementId + sampleId', async () => {
        jest.useFakeTimers();
        const { apply_restore_focus_instruction } = await import('../../js/logic/focus_manager.js');
        const root = document.createElement('div');
        const block = document.createElement('div');
        block.setAttribute('data-requirement-id', 'R');
        block.setAttribute('data-sample-id', 'S');
        root.appendChild(block);
        document.body.appendChild(root);
        window.__gv_restore_focus_info = { requirementId: 'R', sampleId: 'S' };
        const focus_spy = jest.spyOn(block, 'focus');
        apply_restore_focus_instruction({ view_root: root });
        await jest.advanceTimersByTimeAsync(250);
        expect(focus_spy).toHaveBeenCalled();
        focus_spy.mockRestore();
    });
});
