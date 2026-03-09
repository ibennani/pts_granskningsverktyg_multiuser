import { jest } from '@jest/globals';
import { get_base_url, login } from '../../js/api/client.js';

describe('auth/login med username', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        sessionStorage.clear();
    });

    test('login skickar username och password till /auth/login', async () => {
        const base = get_base_url();
        const token = 'dummy-token';

        fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ token })
        });

        const username = 'testuser';
        const password = 'hemligt-losenord';

        const data = await login(username, password);

        expect(data.token).toBe(token);
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe(`${base}/auth/login`);
        expect(options.method).toBe('POST');
        const body = JSON.parse(options.body);
        expect(body).toEqual({ username, password });
    });
});

