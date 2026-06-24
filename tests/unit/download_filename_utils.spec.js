import { jest } from '@jest/globals';
import {
    get_download_filename_datetime,
    get_download_filename_date,
    get_server_filename_datetime,
    sanitize_filename_segment,
    trigger_browser_blob_download,
} from '../../js/utils/download_filename_utils.ts';

describe('download_filename_utils', () => {
    test('sanitize_filename_segment gör segment filnamnsvänligt', () => {
        expect(sanitize_filename_segment('a:b')).toBe('a_b');
        expect(sanitize_filename_segment('  hej där  ')).toBe('hej_där');
        expect(sanitize_filename_segment('x/y\\z')).toBe('x_y_z');
    });

    test('get_download_filename_datetime formaterar UTC-iso till svensk tid', () => {
        expect(get_download_filename_datetime('2026-06-21T08:11:12.000Z')).toBe('20260621_101112');
    });

    test('get_download_filename_datetime tolkar iso utan tidszon som UTC', () => {
        expect(get_download_filename_datetime('2026-06-21T08:11:12.000')).toBe('20260621_101112');
    });

    test('get_download_filename_datetime cachar per iso', () => {
        const iso = '2026-01-01T00:00:00.000Z';
        const a = get_download_filename_datetime(iso);
        const b = get_download_filename_datetime(iso);
        expect(a).toBe('20260101_010000');
        expect(b).toBe('20260101_010000');
    });

    test('get_download_filename_datetime utan iso returnerar aktuell tid i svensk tidszon', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-21T08:11:12.000Z'));
        expect(get_download_filename_datetime(null)).toBe('20260621_101112');
        jest.useRealTimers();
    });

    test('get_download_filename_date ger YYYY-MM-DD vid nedladdning', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));
        expect(get_download_filename_date(null, '-')).toBe('2026-06-18');
        jest.useRealTimers();
    });

    test('get_server_filename_datetime är alias till synkron funktion', async () => {
        await expect(get_server_filename_datetime('2026-06-21T08:11:12.000Z')).resolves.toBe('20260621_101112');
    });

    test('trigger_browser_blob_download skapar länk och rensar object URL', () => {
        const blob = new Blob(['hej'], { type: 'text/plain' });
        const click = jest.fn();
        const append = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => {
            el.click = click;
            return el;
        });
        const remove = jest.spyOn(document.body, 'removeChild').mockImplementation((el) => el);
        const saved_create = global.URL.createObjectURL;
        const saved_revoke = global.URL.revokeObjectURL;
        global.URL.createObjectURL = jest.fn(() => 'blob:test');
        global.URL.revokeObjectURL = jest.fn();

        trigger_browser_blob_download(blob, 'test.txt', { aria_hidden: true });

        expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
        expect(click).toHaveBeenCalledTimes(1);
        expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
        const link = append.mock.calls[0][0];
        expect(link.download).toBe('test.txt');
        expect(link.getAttribute('aria-hidden')).toBe('true');

        append.mockRestore();
        remove.mockRestore();
        global.URL.createObjectURL = saved_create;
        global.URL.revokeObjectURL = saved_revoke;
    });
});
