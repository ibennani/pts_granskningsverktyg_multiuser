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
    api_patch
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
});
