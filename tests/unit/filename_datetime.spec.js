/**
 * @jest-environment node
 */
import {
    FILENAME_DISPLAY_TIMEZONE,
    format_filename_date_for_download,
    format_filename_datetime_for_download,
    format_filename_datetime_from_iso,
    format_local_iso_with_display_timezone_offset,
    parse_iso_to_date,
} from '../../shared/datetime/filename_datetime.js';

describe('filename_datetime (Europe/Stockholm)', () => {
    test('konstant är Europe/Stockholm', () => {
        expect(FILENAME_DISPLAY_TIMEZONE).toBe('Europe/Stockholm');
    });

    test('format_filename_datetime_for_download: vintertid (UTC+1)', () => {
        expect(format_filename_datetime_for_download('2026-01-15T12:00:00.000Z')).toBe('20260115_130000');
    });

    test('format_filename_datetime_for_download: sommartid (UTC+2)', () => {
        expect(format_filename_datetime_for_download('2026-06-15T10:30:45.000Z')).toBe('20260615_123045');
    });

    test('format_filename_date_for_download med och utan separator', () => {
        expect(format_filename_date_for_download('2026-01-15T23:30:00.000Z', '-')).toBe('2026-01-16');
        expect(format_filename_date_for_download('2026-01-15T12:00:00.000Z')).toBe('20260115');
    });

    test('format_local_iso_with_display_timezone_offset inkluderar offset', () => {
        const iso = format_local_iso_with_display_timezone_offset('2026-06-15T10:00:00.000Z');
        expect(iso).toBe('2026-06-15T12:00:00+02:00');
    });

    test('parse_iso_to_date lägger till Z när tidszon saknas', () => {
        const d = parse_iso_to_date('2026-06-21T08:11:12.000');
        expect(d?.toISOString()).toBe('2026-06-21T08:11:12.000Z');
    });

    test('format_filename_datetime_from_iso matchar explicit UTC', () => {
        expect(format_filename_datetime_from_iso('2026-06-21T08:11:12.000Z')).toBe('20260621_101112');
        expect(format_filename_datetime_from_iso('2026-06-21T08:11:12.000')).toBe('20260621_101112');
    });
});
