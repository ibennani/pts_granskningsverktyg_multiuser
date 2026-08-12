import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const db_path = path.join(spec_dir, '../../server/db.js');

const query_mock = jest.fn();

jest.unstable_mockModule(db_path, () => ({
    query: query_mock,
}));

const {
    resolve_snapshot_capture_url_for_audit,
    resolve_snapshot_list_requested_url,
    SnapshotSampleNotFoundError,
    SnapshotSampleMissingUrlError,
} = await import('../../server/services/audit_snapshot_capture_url.ts');

describe('audit_snapshot_capture_url', () => {
    beforeEach(() => {
        query_mock.mockReset();
    });

    test('resolve_snapshot_list_requested_url prioriterar granskningsdelens URL', () => {
        expect(
            resolve_snapshot_list_requested_url(
                { url: 'https://www.apohem.se/sok?q=tandkr%C3%A4m' },
                'https://www.apohem.se/produkt',
                'https://www.apohem.se/produkt'
            )
        ).toBe('https://www.apohem.se/sok?q=tandkr%C3%A4m');
    });

    test('resolve_snapshot_list_requested_url faller tillbaka till snapshot-URL utan granskningsdel', () => {
        expect(
            resolve_snapshot_list_requested_url(
                undefined,
                'https://pending.example',
                'https://ready.example'
            )
        ).toBe('https://pending.example');
    });

    test('resolve_snapshot_capture_url_for_audit använder granskningsdelens URL', async () => {
        query_mock.mockResolvedValue({
            rows: [
                {
                    samples: [
                        {
                            id: 'sample-search',
                            url: 'https://www.apohem.se/sok?q=tandkr%C3%A4m',
                        },
                    ],
                },
            ],
        });

        const result = await resolve_snapshot_capture_url_for_audit(
            'audit-1',
            'sample-search',
            'https://www.apohem.se/sar-bett-stick/sar/sartvatt/ekodes-smart-desinfektion-100-ml'
        );

        expect(result.url).toBe('https://www.apohem.se/sok?q=tandkr%C3%A4m');
        expect(result.client_url_ignored).toBe(true);
    });

    test('resolve_snapshot_capture_url_for_audit kastar om granskningsdel saknas', async () => {
        query_mock.mockResolvedValue({
            rows: [{ samples: [{ id: 'other', url: 'https://example.com' }] }],
        });

        await expect(
            resolve_snapshot_capture_url_for_audit('audit-1', 'missing', 'https://example.com')
        ).rejects.toBeInstanceOf(SnapshotSampleNotFoundError);
    });

    test('resolve_snapshot_capture_url_for_audit kastar om granskningsdel saknar URL', async () => {
        query_mock.mockResolvedValue({
            rows: [{ samples: [{ id: 'sample-a', url: '' }] }],
        });

        await expect(
            resolve_snapshot_capture_url_for_audit('audit-1', 'sample-a', 'https://example.com')
        ).rejects.toBeInstanceOf(SnapshotSampleMissingUrlError);
    });
});
