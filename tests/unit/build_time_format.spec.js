/**
 * @jest-environment node
 */
import { format_build_info_object } from '../../js/utils/build_time_format.js';

describe('format_build_info_object', () => {
    test('använder Europe/Stockholm för fast UTC-ögonblick (vintertid)', () => {
        const info = format_build_info_object('2026-01-15T12:00:00.000Z', { include_seconds: false });
        expect(info.date).toBe('2026-01-15');
        expect(info.time).toBe('13:00');
        expect(info.timestamp).toBe('2026-01-15T12:00:00.000Z');
    });

    test('kan inkludera sekunder i utvecklingsläge', () => {
        const info = format_build_info_object('2026-01-15T12:00:00.000Z', { include_seconds: true });
        expect(info.time).toMatch(/^13:00:00$/);
    });
});
