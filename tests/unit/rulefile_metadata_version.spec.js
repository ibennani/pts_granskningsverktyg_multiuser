import { describe, test, expect } from '@jest/globals';
import { compute_next_rulefile_metadata_version } from '../../shared/rulefile/rulefile_metadata_version.js';
import {
    touch_rulefile_metadata,
    resolve_publish_production_version,
    format_rulefile_date_modified
} from '../../shared/rulefile/rulefile_metadata_touch.js';
import {
    to_filename_version_suffix,
    build_rulefile_download_filename
} from '../../shared/rulefile/rulefile_filename.js';
import { prepare_rulefile_content_for_persist } from '../../js/logic/prepare_rulefile_content_for_persist.ts';

describe('rulefile_metadata_version', () => {
    test('ökar r med 1 när år och månad matchar', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(compute_next_rulefile_metadata_version('2026.5.r3', d)).toBe('2026.5.r4');
        expect(compute_next_rulefile_metadata_version('2026.05.r3', d)).toBe('2026.5.r4');
        expect(compute_next_rulefile_metadata_version('2026.5.r0', d)).toBe('2026.5.r1');
    });

    test('startar om på r1 när månad skiljer', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(compute_next_rulefile_metadata_version('2026.4.r99', d)).toBe('2026.5.r1');
    });

    test('startar om på r1 när år skiljer', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(compute_next_rulefile_metadata_version('2025.5.r7', d)).toBe('2026.5.r1');
    });

    test('startar om på r1 vid ogiltig eller saknad version', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(compute_next_rulefile_metadata_version(null, d)).toBe('2026.5.r1');
        expect(compute_next_rulefile_metadata_version('', d)).toBe('2026.5.r1');
        expect(compute_next_rulefile_metadata_version('2026.5', d)).toBe('2026.5.r1');
        expect(compute_next_rulefile_metadata_version('abc', d)).toBe('2026.5.r1');
    });
});

describe('rulefile_metadata_touch', () => {
    test('touch_rulefile_metadata sätter dateModified utan att bumpa version', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        const out = touch_rulefile_metadata(
            { metadata: { version: '2026.5.r3', title: 'Test' }, requirements: {} },
            { bump_version: false, reference_date: d }
        );
        expect(out.metadata.version).toBe('2026.5.r3');
        expect(out.metadata.dateModified).toBe('2026-05-06');
    });

    test('touch_rulefile_metadata bump:ar version och dateModified', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        const out = touch_rulefile_metadata(
            { metadata: { version: '2026.5.r3' } },
            { bump_version: true, reference_date: d }
        );
        expect(out.metadata.version).toBe('2026.5.r4');
        expect(out.metadata.dateModified).toBe('2026-05-06');
    });

    test('resolve_publish_production_version behåller utkastets version', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(resolve_publish_production_version('2026.5.r9', '2026.5.r1', d)).toBe('2026.5.r9');
    });

    test('resolve_publish_production_version bump:ar från publicerad när utkast saknar version', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        expect(resolve_publish_production_version('', '2026.5.r3', d)).toBe('2026.5.r4');
    });

    test('format_rulefile_date_modified returnerar YYYY-MM-DD', () => {
        expect(format_rulefile_date_modified(new Date('2026-05-06T23:59:00.000Z'))).toBe('2026-05-06');
    });
});

describe('rulefile_filename', () => {
    test('to_filename_version_suffix konverterar versionssträng', () => {
        expect(to_filename_version_suffix('2026.5.r3')).toBe('2026_5_r3');
        expect(to_filename_version_suffix('invalid')).toBeNull();
    });

    test('build_rulefile_download_filename bygger säkert filnamn', () => {
        expect(build_rulefile_download_filename('Min regel', '2026.5.r3')).toBe(
            'Min_regel_2026_5_r3.json'
        );
    });
});

describe('prepare_rulefile_content_for_persist', () => {
    test('delegerar till touch_rulefile_metadata', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        const out = prepare_rulefile_content_for_persist(
            { metadata: { version: '2026.5.r1' } },
            { bump_version: true, reference_date: d }
        );
        expect(out?.metadata?.version).toBe('2026.5.r2');
        expect(out?.metadata?.dateModified).toBe('2026-05-06');
    });

    test('tar bort vocabularies före versionsbump', () => {
        const d = new Date('2026-05-06T12:00:00.000Z');
        const out = prepare_rulefile_content_for_persist(
            {
                metadata: {
                    version: '2026.5.r1',
                    pageTypes: ['Startsida'],
                    vocabularies: { pageTypes: ['Startsida'] }
                },
                requirements: {}
            },
            { bump_version: true, reference_date: d }
        );
        expect(out?.metadata?.vocabularies).toBeUndefined();
        expect(out?.metadata?.pageTypes).toEqual(['Startsida']);
        expect(out?.metadata?.version).toBe('2026.5.r2');
    });
});

