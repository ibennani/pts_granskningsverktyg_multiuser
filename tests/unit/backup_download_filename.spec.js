import {
    backup_word_for_rulefile_language,
    build_rulefile_backup_download_filename,
    format_local_datetime_for_backup_filename,
    metadata_version_to_filename_part,
    sanitize_filename_segment,
    strip_rulefile_disk_id_suffix
} from '../../js/logic/backup_download_filename.ts';

describe('backup_download_filename', () => {
    test('sanitize_filename_segment tar bort ogiltiga tecken', () => {
        expect(sanitize_filename_segment('a:b')).toBe('a_b');
        expect(sanitize_filename_segment('  ok  ')).toBe('ok');
    });

    test('format_local_datetime_for_backup_filename ger YYYYMMDD_HHMMSS', () => {
        const s = format_local_datetime_for_backup_filename('2025-06-01T15:04:05.000Z');
        expect(s).toMatch(/^\d{8}_\d{6}$/);
    });

    test('format_local_datetime_for_backup_filename hanterar saknat värde', () => {
        expect(format_local_datetime_for_backup_filename(null)).toBe('saknad-tidpunkt');
        expect(format_local_datetime_for_backup_filename('')).toBe('saknad-tidpunkt');
    });

    test('strip_rulefile_disk_id_suffix tar bort __hex i slutet', () => {
        expect(strip_rulefile_disk_id_suffix('foo__f6aa1b17')).toBe('foo');
        expect(strip_rulefile_disk_id_suffix('foo_bar')).toBe('foo_bar');
    });

    test('metadata_version_to_filename_part byter punkt mot understreck', () => {
        expect(metadata_version_to_filename_part('2026.3.r2')).toBe('2026_3_r2');
    });

    test('backup_word_for_rulefile_language följer regelfilens språk', () => {
        expect(backup_word_for_rulefile_language('sv-SE')).toBe('säkerhetskopia');
        expect(backup_word_for_rulefile_language('en-GB')).toBe('backup');
        expect(backup_word_for_rulefile_language('nb-NO')).toBe('sikkerhetskopi');
        expect(backup_word_for_rulefile_language(null)).toBe('säkerhetskopia');
        expect(backup_word_for_rulefile_language('de')).toBe('backup');
    });

    test('build_rulefile_backup_download_filename: säkerhetskopia, version och tid', () => {
        const name = build_rulefile_backup_download_filename({
            filename: 'rulesnapshot.json',
            metadataVersion: '2025.2.r4',
            metadataLanguage: 'sv-SE',
            createdAt: '2025-01-15T14:00:00.000Z'
        });
        expect(name).toMatch(/^rulesnapshot_säkerhetskopia_2025_2_r4_\d{8}_\d{6}\.json$/);
    });

    test('build_rulefile_backup_download_filename: engelskt regelfilsspråk ger backup i namnet', () => {
        const name = build_rulefile_backup_download_filename({
            filename: 'rulesnapshot.json',
            metadataVersion: '1.0.r1',
            metadataLanguage: 'en-GB',
            createdAt: '2025-01-15T14:00:00.000Z'
        });
        expect(name).toMatch(/^rulesnapshot_backup_1_0_r1_\d{8}_\d{6}\.json$/);
    });

    test('build_rulefile_backup_download_filename: tar bort __id och rätt mönster (pts…)', () => {
        const name = build_rulefile_backup_download_filename({
            filename: 'pts_tillsynsregler_for_granskning_av_webbplatser__f6aa1b17.json',
            metadataVersion: '2026.3.r2',
            createdAt: '2026-04-14T12:00:01.000Z'
        });
        expect(name).not.toContain('f6aa1b17');
        expect(name).not.toContain('2026.3.r2');
        expect(name).toMatch(
            /^pts_tillsynsregler_for_granskning_av_webbplatser_säkerhetskopia_2026_3_r2_\d{8}_\d{6}\.json$/
        );
    });

    test('build_rulefile_backup_download_filename: utan version, bara säkerhetskopia och tid', () => {
        const name = build_rulefile_backup_download_filename({
            filename: 'x.json',
            metadataVersion: null,
            createdAt: '2025-03-20T08:00:00.000Z'
        });
        expect(name).toMatch(/^x_säkerhetskopia_\d{8}_\d{6}\.json$/);
    });
});
