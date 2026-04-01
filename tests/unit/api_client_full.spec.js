/**
 * Utökade tester för js/api/client.js (auth, headers, HTTP-metoder).
 * fetch och sessionStorage används via globala mocks / jsdom.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
    get_auth_token,
    set_auth_token,
    clear_auth_token,
    get_base_url,
    get_auth_headers,
    login,
    api_get,
    api_post,
    api_put,
    api_delete,
    api_patch,
    reset_password_with_code,
    change_my_password,
    get_admin_contacts,
    get_rules,
    get_audits,
    create_audit,
    delete_audit,
    update_audit,
    load_audit_with_rule_file
} from '../../js/api/client.js';

describe('api/client – token och bas-URL', () => {
    beforeEach(() => {
        sessionStorage.clear();
        delete window.__GV_API_BASE__;
        global.fetch = jest.fn();
    });

    test('set_auth_token, get_auth_token och clear_auth_token', () => {
        expect(get_auth_token()).toBe(null);
        set_auth_token('abc');
        expect(get_auth_token()).toBe('abc');
        clear_auth_token();
        expect(get_auth_token()).toBe(null);
    });

    test('set_auth_token ignorerar tom token', () => {
        set_auth_token('');
        expect(get_auth_token()).toBe(null);
    });

    test('get_base_url använder standard eller __GV_API_BASE__', () => {
        expect(get_base_url()).toMatch(/v2\/api$/);
        window.__GV_API_BASE__ = '/api/';
        expect(get_base_url()).toBe('/api');
    });

    test('get_auth_headers inkluderar Bearer vid token', () => {
        set_auth_token('tok');
        const h = get_auth_headers();
        expect(h['Content-Type']).toBe('application/json');
        expect(h.Authorization).toBe('Bearer tok');
        clear_auth_token();
        const h2 = get_auth_headers();
        expect(h2.Authorization).toBeUndefined();
    });
});

describe('api/client – login och HTTP-metoder', () => {
    beforeEach(() => {
        sessionStorage.clear();
        global.fetch = jest.fn();
    });

    test('login lyckas och returnerar data', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ token: 't1', user: { name: 'U' } })
        });
        const data = await login('u', 'p');
        expect(data.token).toBe('t1');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringMatching(/\/auth\/login$/),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ username: 'u', password: 'p' })
            })
        );
    });

    test('login misslyckas med felmeddelande', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Fel lösenord' })
        });
        await expect(login('u', 'bad')).rejects.toMatchObject({
            message: 'Fel lösenord',
            status: 401
        });
    });

    test('api_get returnerar JSON vid 200', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: '1' })
        });
        const out = await api_get('/x');
        expect(out).toEqual({ id: '1' });
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/x'),
            expect.objectContaining({ cache: 'no-store' })
        );
    });

    test('api_post skickar JSON-kropp', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ok: true })
        });
        const body = { a: 1 };
        const out = await api_post('/audits', body);
        expect(out).toEqual({ ok: true });
        const call = fetch.mock.calls[0];
        expect(call[1].method).toBe('POST');
        expect(call[1].body).toBe(JSON.stringify(body));
    });

    test('api_put skickar PUT', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ v: 2 })
        });
        const out = await api_put('/a/1', { x: 1 });
        expect(out).toEqual({ v: 2 });
        expect(fetch.mock.calls[0][1].method).toBe('PUT');
    });

    test('api_delete vid 204 returnerar null', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 204,
            json: async () => {
                throw new Error('should not parse');
            }
        });
        const out = await api_delete('/a/1');
        expect(out).toBe(null);
    });

    test('api_patch skickar PATCH', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ patched: true })
        });
        const out = await api_patch('/a/1', { f: 1 });
        expect(out).toEqual({ patched: true });
        expect(fetch.mock.calls[0][1].method).toBe('PATCH');
    });

    test('api_get vid 404 kastar med status', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: async () => ({ error: 'Saknas' })
        });
        await expect(api_get('/missing')).rejects.toMatchObject({ message: 'Saknas', status: 404 });
    });

    test('api_get vid 500 kastar', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Error',
            json: async () => ({ error: 'Serverfel' })
        });
        await expect(api_get('/boom')).rejects.toMatchObject({ status: 500 });
    });

    test('api_post (ej login) vid 401 rensar session och kastar', async () => {
        set_auth_token('gammal');
        let auth_event = false;
        const h = () => { auth_event = true; };
        window.addEventListener('gv-auth-required', h);
        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' })
        });
        await expect(api_post('/audits', {})).rejects.toMatchObject({ status: 401 });
        expect(get_auth_token()).toBe(null);
        expect(auth_event).toBe(true);
        window.removeEventListener('gv-auth-required', h);
    });
});

describe('api/client – lösenord och admin-kontakter', () => {
    beforeEach(() => {
        sessionStorage.clear();
        global.fetch = jest.fn();
    });

    test('reset_password_with_code lyckas', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ ok: true })
        });
        const out = await reset_password_with_code('kod', 'nytt');
        expect(out.ok).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringMatching(/\/auth\/reset-password$/),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ code: 'kod', password: 'nytt' })
            })
        );
    });

    test('reset_password_with_code misslyckas', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Ogiltig kod' })
        });
        await expect(reset_password_with_code('x', 'y')).rejects.toMatchObject({
            message: 'Ogiltig kod',
            status: 400
        });
    });

    test('change_my_password lyckas', async () => {
        set_auth_token('jwt');
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        });
        const out = await change_my_password('hemligt');
        expect(out.success).toBe(true);
        expect(fetch.mock.calls[0][0]).toContain('/auth/change-password');
    });

    test('change_my_password fel utan att trigga global utloggning', async () => {
        set_auth_token('jwt');
        fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Svagt lösenord' })
        });
        await expect(change_my_password('1')).rejects.toMatchObject({ status: 400 });
        expect(get_auth_token()).toBe('jwt');
    });

    test('get_admin_contacts: publikt anrop lyckas', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ admins: [{ id: '1', name: 'Admin' }] })
        });
        const out = await get_admin_contacts();
        expect(out.fetched).toBe(true);
        expect(out.list).toHaveLength(1);
        expect(out.list[0].name).toBe('Admin');
    });

    test('get_admin_contacts: fallback till api_get när publikt misslyckas', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [{ username: 'a2' }]
            });
        set_auth_token('tok');
        const out = await get_admin_contacts();
        expect(out.fetched).toBe(true);
        expect(out.list[0].username).toBe('a2');
    });

    test('get_admin_contacts: inget fungerar ger fetched false', async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({})
        });
        const out = await get_admin_contacts();
        expect(out.fetched).toBe(false);
        expect(out.list).toEqual([]);
    });
});

describe('api/client – regler och granskningar', () => {
    beforeEach(() => {
        sessionStorage.clear();
        set_auth_token('tok');
        global.fetch = jest.fn();
    });

    test('get_rules anropar /rules', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => [{ id: 'r1' }]
        });
        const rules = await get_rules();
        expect(rules).toEqual([{ id: 'r1' }]);
        expect(fetch.mock.calls[0][0]).toMatch(/\/rules$/);
    });

    test('get_audits med status-query', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => []
        });
        await get_audits('in_progress');
        expect(fetch.mock.calls[0][0]).toContain('status=in_progress');
    });

    test('create_audit skickar rule_set_id', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ auditId: 'new' })
        });
        const out = await create_audit('rs-1');
        expect(out.auditId).toBe('new');
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ rule_set_id: 'rs-1' });
    });

    test('delete_audit anropar DELETE', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 204,
            json: async () => {
                throw new Error('no body');
            }
        });
        const out = await delete_audit('aid');
        expect(out).toBe(null);
        expect(fetch.mock.calls[0][1].method).toBe('DELETE');
    });

    test('update_audit använder PATCH', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ version: 3 })
        });
        const out = await update_audit('aid', { metadata: {} });
        expect(out.version).toBe(3);
        expect(fetch.mock.calls[0][1].method).toBe('PATCH');
    });

    test('load_audit_with_rule_file hämtar regel när innehåll saknas', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ id: 'a1', ruleSetId: 'rs9' })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    published_content: { metadata: { v: 1 }, requirements: {} }
                })
            });
        const merged = await load_audit_with_rule_file('a1');
        expect(merged.ruleFileContent).toEqual({ metadata: { v: 1 }, requirements: {} });
    });
});
