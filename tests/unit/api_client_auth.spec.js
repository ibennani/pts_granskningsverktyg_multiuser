import { jest } from '@jest/globals';
import { api_get, get_auth_token, set_auth_token } from '../../js/api/client.js';

describe('api/client – 401-hantering', () => {
    beforeEach(() => {
        sessionStorage.clear();
        delete window.__GV_CURRENT_USER_NAME__;
        global.fetch = jest.fn();
    });

    test('api_get vid 401 rensar token och triggar gv-auth-required', async () => {
        set_auth_token('ogiltig-token');
        sessionStorage.setItem('gv_current_user_name', 'Test');
        window.__GV_CURRENT_USER_NAME__ = 'Test';

        let auth_event_fired = false;
        const handler = () => { auth_event_fired = true; };
        window.addEventListener('gv-auth-required', handler);

        fetch.mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Unauthorized' })
        });

        let err = null;
        try {
            await api_get('/audits/1');
        } catch (e) {
            err = e;
        }

        window.removeEventListener('gv-auth-required', handler);

        expect(err).toBeTruthy();
        expect(err.status).toBe(401);
        expect(auth_event_fired).toBe(true);
        expect(get_auth_token()).toBe(null);
        expect(sessionStorage.getItem('gv_current_user_name')).toBe(null);
        expect(window.__GV_CURRENT_USER_NAME__).toBeUndefined();
    });
});

