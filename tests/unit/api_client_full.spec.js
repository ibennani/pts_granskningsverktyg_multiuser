/**
 * Utökade tester för js/api/client.js (auth, headers, HTTP-metoder).
 * fetch och sessionStorage används via globala mocks / jsdom.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
    get_auth_token,
    set_auth_token,
    clear_auth_token,
    is_current_user_admin,
    set_current_user_admin,
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
    get_rule,
    get_rule_version,
    get_audits,
    get_audit,
    create_rule,
    update_rule,
    delete_rule,
    publish_rule,
    copy_rule,
    create_audit,
    delete_audit,
    update_audit,
    load_audit_with_rule_file,
    get_users,
    create_user,
    update_user,
    delete_user,
    get_backup_overview,
    run_backup_now,
    get_backup_settings,
    create_password_reset_code,
    get_websocket_url,
    get_audit_version,
    import_audit,
    import_rule,
    create_production_rule,
    publish_production_rule,
    export_rule,
    get_backups_for_audit,
    save_audit_backup_on_server,
    update_backup_settings,
    update_current_user_preferences,
    get_user_audit_count,
    patch_requirement_result,
    check_api_available,
    get_current_user_preferences
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

    test('is_current_user_admin och set_current_user_admin', () => {
        sessionStorage.removeItem('gv_current_user_is_admin');
        expect(is_current_user_admin()).toBe(false);
        set_current_user_admin(true);
        expect(is_current_user_admin()).toBe(true);
        set_current_user_admin(false);
        expect(is_current_user_admin()).toBe(false);
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

    test('api_get vid nätverksfel (fetch kastar) propagerar felet', async () => {
        set_auth_token('tok');
        fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        await expect(api_get('/audits')).rejects.toThrow('Failed to fetch');
    });

    test('api_get vid 200 men trasig JSON kastar parsningsfel', async () => {
        set_auth_token('tok');
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => {
                throw new SyntaxError('Unexpected token');
            }
        });
        await expect(api_get('/audits')).rejects.toThrow(SyntaxError);
    });

    test('api_get vid 401 utan lyckad refresh rensar och dispatchar gv-auth-required', async () => {
        const handler = jest.fn();
        window.addEventListener('gv-auth-required', handler);
        set_auth_token('utgången');
        fetch
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Utgången' })
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Refresh nej' })
            });
        await expect(api_get('/rules')).rejects.toMatchObject({ message: 'Inloggning krävs' });
        expect(get_auth_token()).toBe(null);
        expect(handler).toHaveBeenCalled();
        window.removeEventListener('gv-auth-required', handler);
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

    test('api_post vid timeout-liknande avbrott kastar fel', async () => {
        set_auth_token('tok');
        fetch.mockImplementation(
            () =>
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('timeout')), 5);
                })
        );
        await expect(api_post('/audits', {})).rejects.toThrow('timeout');
    });

    test('api_post vid 200 men trasig JSON kastar', async () => {
        set_auth_token('tok');
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => {
                throw new SyntaxError('bad json');
            }
        });
        await expect(api_post('/audits', {})).rejects.toThrow(SyntaxError);
    });

    test('api_post vid fel sätter existingAuditId och existingAuditSummary', async () => {
        set_auth_token('tok');
        fetch.mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({
                error: 'Finns redan',
                existingAuditId: 'a-old',
                existingAuditSummary: { title: 'T' }
            })
        });
        try {
            await api_post('/audits/import', {});
            expect.fail('ska kasta');
        } catch (e) {
            expect(e.status).toBe(409);
            expect(e.existingAuditId).toBe('a-old');
            expect(e.existingAuditSummary).toEqual({ title: 'T' });
        }
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

    test('api_put vid 401 kastar Inloggning krävs', async () => {
        set_auth_token('x');
        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Nej' })
        });
        await expect(api_put('/x', {})).rejects.toMatchObject({
            message: 'Inloggning krävs',
            status: 401
        });
    });

    test('api_put vid fel med detail kombinerar meddelande', async () => {
        set_auth_token('tok');
        fetch.mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad',
            json: async () => ({ error: 'Validering', detail: 'fält' })
        });
        await expect(api_put('/rules/1', {})).rejects.toMatchObject({
            message: 'Validering: fält',
            status: 400
        });
    });

    test('api_delete vid 200 returnerar parsat JSON', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ deleted: true })
        });
        const out = await api_delete('/a/1');
        expect(out).toEqual({ deleted: true });
    });

    test('api_delete vid 401 rensar session', async () => {
        set_auth_token('tok');
        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Ut' })
        });
        await expect(api_delete('/x')).rejects.toMatchObject({ status: 401 });
        expect(get_auth_token()).toBe(null);
    });

    test('api_delete vid fel sätter responseBody', async () => {
        set_auth_token('tok');
        fetch.mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({ conflict: true })
        });
        try {
            await api_delete('/x');
            expect.fail('ska kasta');
        } catch (e) {
            expect(e.status).toBe(409);
            expect(e.responseBody).toEqual({ conflict: true });
        }
    });

    test('api_delete vid 204 returnerar null (status 204)', async () => {
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

    test('api_patch vid 401 utan lyckad refresh kastar Inloggning krävs', async () => {
        const handler = jest.fn();
        window.addEventListener('gv-auth-required', handler);
        set_auth_token('utgången');
        fetch
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({})
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Refresh nej' })
            });
        await expect(api_patch('/audits/a', {})).rejects.toMatchObject({
            message: 'Inloggning krävs',
            status: 401
        });
        expect(get_auth_token()).toBe(null);
        expect(handler).toHaveBeenCalled();
        window.removeEventListener('gv-auth-required', handler);
    });

    test('api_patch vid 401 och lyckad refresh gör om PATCH', async () => {
        set_auth_token('gammal');
        fetch
            .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: 'ny' }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ version: 5 }) });
        const out = await api_patch('/audits/a', { samples: [] });
        expect(out).toEqual({ version: 5 });
        expect(get_auth_token()).toBe('ny');
        expect(fetch.mock.calls.length).toBe(3);
    });

    test('api_patch vid konflikt sätter serverVersion och existingAuditId', async () => {
        set_auth_token('t');
        fetch.mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({
                error: 'Version',
                serverVersion: 7,
                existingAuditId: 'aid'
            })
        });
        try {
            await api_patch('/audits/a', {});
            expect.fail('ska kasta');
        } catch (e) {
            expect(e.status).toBe(409);
            expect(e.serverVersion).toBe(7);
            expect(e.existingAuditId).toBe('aid');
        }
    });

    test('api_patch vid versionskonflikt sätter lastUpdatedBy', async () => {
        set_auth_token('t');
        fetch.mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({
                error: 'Versionskonflikt',
                serverVersion: 3,
                lastUpdatedBy: 'Testare'
            })
        });
        try {
            await api_patch('/audits/a', {});
            expect.fail('ska kasta');
        } catch (e) {
            expect(e.status).toBe(409);
            expect(e.serverVersion).toBe(3);
            expect(e.lastUpdatedBy).toBe('Testare');
        }
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

    test('api_get vid 401 rensar session och kastar Inloggning krävs', async () => {
        set_auth_token('t');
        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Nej' })
        });
        await expect(api_get('/secret')).rejects.toMatchObject({
            message: 'Inloggning krävs',
            status: 401
        });
        expect(get_auth_token()).toBe(null);
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

    test('api_get: nätverksfel (fetch kastar) propagerar', async () => {
        fetch.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(api_get('/x')).rejects.toThrow('Failed to fetch');
    });

    test('api_get: ogiltigt JSON-svar kastar vid parsning', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => {
                throw new SyntaxError('ogiltig json');
            }
        });
        await expect(api_get('/x')).rejects.toThrow('ogiltig json');
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

    test('get_admin_contacts: nätverksfel på publikt anrop faller tillbaka', async () => {
        fetch
            .mockRejectedValueOnce(new Error('nät ner'))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [{ username: 'fallback' }]
            });
        set_auth_token('tok');
        const out = await get_admin_contacts();
        expect(out.fetched).toBe(true);
        expect(out.list[0].username).toBe('fallback');
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

    test('load_audit_with_rule_file: returnerar direkt om ruleFileContent redan finns', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'a1', ruleFileContent: { k: 1 } })
        });
        const out = await load_audit_with_rule_file('a1');
        expect(out.ruleFileContent).toEqual({ k: 1 });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('load_audit_with_rule_file: utan ruleSetId ingen extra regelhämtning', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'a1', samples: [] })
        });
        const out = await load_audit_with_rule_file('a1');
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(out.ruleFileContent).toBeUndefined();
    });

    test('load_audit_with_rule_file: använder content när published_content saknas', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ id: 'a1', ruleSetId: 'rs' })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ content: { metadata: {}, requirements: {} } })
            });
        const out = await load_audit_with_rule_file('a1');
        expect(out.ruleFileContent).toEqual({ metadata: {}, requirements: {} });
    });

    test('load_audit_with_rule_file: utan regelinnehåll returneras audit oförändrat', async () => {
        fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ id: 'a1', ruleSetId: 'rs' })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ id: 'rs' })
            });
        const out = await load_audit_with_rule_file('a1');
        expect(out.ruleFileContent).toBeUndefined();
        expect(out.id).toBe('a1');
    });

    test('get_rule och get_rule_version anropar rätt sökvägar', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: 'r1' })
        });
        await get_rule('r1');
        expect(fetch.mock.calls[0][0]).toMatch(/\/rules\/r1$/);
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ version: 2 })
        });
        await get_rule_version('r1');
        expect(fetch.mock.calls[1][0]).toMatch(/\/rules\/r1\/version$/);
    });

    test('create_rule, update_rule, delete_rule, publish_rule, copy_rule', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'new' }) });
        await create_rule({ name: 'N' });
        expect(fetch.mock.calls[0][0]).toMatch(/\/rules$/);
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: 'N' });

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
        await update_rule('rid', { content: {} });
        expect(fetch.mock.calls[1][1].method).toBe('PUT');

        fetch.mockResolvedValue({
            ok: true,
            status: 204,
            json: async () => {
                throw new Error('no');
            }
        });
        await delete_rule('rid');
        expect(fetch.mock.calls[2][1].method).toBe('DELETE');

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ published: true }) });
        await publish_rule('rid');
        expect(fetch.mock.calls[3][0]).toMatch(/\/rules\/rid\/publish$/);

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'copy' }) });
        await copy_rule('rid');
        expect(fetch.mock.calls[4][0]).toMatch(/\/rules\/rid\/copy$/);
    });

    test('get_audit hämtar en granskning', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: 'a9' })
        });
        const a = await get_audit('a9');
        expect(a.id).toBe('a9');
        expect(fetch.mock.calls[0][0]).toMatch(/\/audits\/a9$/);
    });

    test('get_current_user_preferences anropar /users/me', async () => {
        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ language: 'sv' })
        });
        const p = await get_current_user_preferences();
        expect(p.language).toBe('sv');
        expect(fetch.mock.calls[0][0]).toMatch(/\/users\/me$/);
    });

    test('get_users, create_user, update_user, delete_user', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
        await get_users();
        expect(fetch.mock.calls[0][0]).toMatch(/\/users$/);

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'u1' }) });
        await create_user({ username: 'x' });
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ username: 'x' });

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
        await update_user('u1', { role: 'admin' });
        expect(fetch.mock.calls[2][1].method).toBe('PUT');

        fetch.mockResolvedValue({
            ok: true,
            status: 204,
            json: async () => {
                throw new Error('no');
            }
        });
        await delete_user('u1');
        expect(fetch.mock.calls[3][1].method).toBe('DELETE');
    });

    test('get_backup_overview, run_backup_now, get_backup_settings', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ rows: [] }) });
        await get_backup_overview();
        expect(fetch.mock.calls[0][0]).toMatch(/\/backup\/list$/);

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ran: true }) });
        await run_backup_now();
        expect(fetch.mock.calls[1][0]).toMatch(/\/backup\/run$/);

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await get_backup_settings();
        expect(fetch.mock.calls[2][0]).toMatch(/\/backup\/settings$/);
    });

    test('create_password_reset_code', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 'x' }) });
        await create_password_reset_code('user-1', 60);
        expect(fetch.mock.calls[0][0]).toContain('/users/user-1/password-reset-codes');
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ expires_in_minutes: 60 });
    });

    test('get_websocket_url bygger ws-URL', () => {
        delete window.__GV_API_BASE__;
        const u = get_websocket_url();
        expect(u).toMatch(/^wss?:\/\//);
        expect(u).toContain('/ws');
    });

    test('get_audit_version', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ v: 1 }) });
        await get_audit_version('a1');
        expect(fetch.mock.calls[0][0]).toMatch(/\/audits\/a1\/version$/);
    });

    test('import_audit med replace_existing_audit_id', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ auditId: 'x' }) });
        await import_audit({ samples: [] }, { replace_existing_audit_id: 'old' });
        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body.replaceExistingAuditId).toBe('old');
    });

    test('import_rule, create_production_rule, publish_production_rule, export_rule', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await import_rule('N', {});
        expect(fetch.mock.calls[0][0]).toMatch(/\/rules\/import$/);

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'p' }) });
        await create_production_rule({ x: 1 });
        expect(fetch.mock.calls[1][0]).toMatch(/\/rules\/production$/);

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await publish_production_rule('rid');
        expect(fetch.mock.calls[2][0]).toMatch(/publish_production/);

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'rid', content: {} }) });
        await export_rule('rid');
        expect(fetch.mock.calls[3][0]).toMatch(/\/export$/);
    });

    test('get_backups_for_audit och save_audit_backup_on_server', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
        await get_backups_for_audit('aid');
        expect(fetch.mock.calls[0][0]).toContain('/backup/');

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
        await save_audit_backup_on_server('aid');
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ auditId: 'aid' });
    });

    test('update_backup_settings och update_current_user_preferences', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await update_backup_settings({ x: 1 });
        expect(fetch.mock.calls[0][1].method).toBe('PUT');

        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await update_current_user_preferences({ lang: 'sv' });
        expect(fetch.mock.calls[1][1].method).toBe('PATCH');
    });

    test('get_user_audit_count', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ count: 3 }) });
        const c = await get_user_audit_count('u1');
        expect(c.count).toBe(3);
        expect(fetch.mock.calls[0][0]).toMatch(/audit-count$/);
    });

    test('patch_requirement_result', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
        await patch_requirement_result('a', 's', 'r', 2, { status: 'pass' });
        expect(fetch.mock.calls[0][0]).toMatch(/\/results\/s\/r$/);
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ version: 2, result: { status: 'pass' } });
    });

    test('check_api_available: true och false', async () => {
        fetch.mockResolvedValue({ ok: true, status: 200 });
        expect(await check_api_available()).toBe(true);

        fetch.mockResolvedValue({ ok: false, status: 503 });
        expect(await check_api_available()).toBe(false);

        fetch.mockRejectedValue(new Error('nät'));
        expect(await check_api_available()).toBe(false);
    });
});
