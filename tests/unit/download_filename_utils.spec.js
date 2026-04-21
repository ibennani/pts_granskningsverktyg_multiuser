import { jest } from '@jest/globals';
import { get_server_filename_datetime, sanitize_filename_segment } from '../../js/utils/download_filename_utils.ts';

describe('download_filename_utils', () => {
    test('sanitize_filename_segment gör segment filnamnsvänligt', () => {
        expect(sanitize_filename_segment('a:b')).toBe('a_b');
        expect(sanitize_filename_segment('  hej där  ')).toBe('hej_där');
        expect(sanitize_filename_segment('x/y\\z')).toBe('x_y_z');
    });

    test('get_server_filename_datetime bygger querystring när iso skickas', async () => {
        const calls = [];
        global.fetch = jest.fn(async (url) => {
            calls.push(String(url));
            return {
                ok: true,
                json: async () => ({ filename_datetime: '20260421_101112' })
            };
        });

        const v = await get_server_filename_datetime('2026-04-21T08:11:12.000Z');
        expect(v).toBe('20260421_101112');
        expect(calls[0]).toContain('/api/time/filename-datetime?iso=');
    });

    test('get_server_filename_datetime cachar per iso', async () => {
        let n = 0;
        global.fetch = jest.fn(async () => {
            n += 1;
            return {
                ok: true,
                json: async () => ({ filename_datetime: '20260101_000000' })
            };
        });

        const iso = '2026-01-01T00:00:00.000Z';
        const a = await get_server_filename_datetime(iso);
        const b = await get_server_filename_datetime(iso);
        expect(a).toBe('20260101_000000');
        expect(b).toBe('20260101_000000');
        expect(n).toBe(1);
    });
});

