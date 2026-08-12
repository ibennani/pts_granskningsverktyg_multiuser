import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const list_mock = jest.fn();

jest.unstable_mockModule('../../server/repositories/audit_snapshot_repository.js', () => ({
    list_audit_snapshots_for_audit: list_mock,
}));

const { build_audit_snapshot_list } = await import('../../server/services/audit_snapshot_list_service.ts');

describe('audit_snapshot_list_service', () => {
    beforeEach(() => {
        list_mock.mockReset();
    });

    test('build_audit_snapshot_list visar färdig och pågående snapshot per sample', async () => {
        const ready_at = new Date('2026-08-10T10:00:00.000Z');
        list_mock.mockResolvedValue([
            {
                id: 'snap-ready',
                audit_id: 'audit-1',
                sample_id: 'sample-a',
                requested_url: 'https://example.com',
                status: 'ready',
                page_title: 'Exempel',
                warning_count: 0,
                size_bytes: 4096,
                error: null,
                created_at: ready_at,
                completed_at: ready_at,
            },
            {
                id: 'snap-pending',
                audit_id: 'audit-1',
                sample_id: 'sample-a',
                requested_url: 'https://example.com',
                status: 'packaging',
                page_title: 'Exempel',
                warning_count: 0,
                size_bytes: null,
                error: null,
                created_at: new Date('2026-08-10T11:00:00.000Z'),
                completed_at: null,
            },
        ]);

        const items = await build_audit_snapshot_list('audit-1', [
            { id: 'sample-a', description: 'Startsida', url: 'https://example.com' },
        ]);

        expect(items).toHaveLength(1);
        expect(items[0].currentReady?.snapshotId).toBe('snap-ready');
        expect(items[0].pendingAttempt?.status).toBe('packaging');
        expect(items[0].sampleDescription).toBe('Startsida');
    });

    test('build_audit_snapshot_list ignorerar gammalt misslyckat försök när färdig sidrapport finns', async () => {
        const ready_at = new Date('2026-08-12T10:00:00.000Z');
        const failed_at = new Date('2026-08-11T09:00:00.000Z');
        list_mock.mockResolvedValue([
            {
                id: 'snap-ready',
                audit_id: 'audit-1',
                sample_id: 'sample-a',
                requested_url: 'https://example.com',
                status: 'ready',
                page_title: 'Exempel',
                warning_count: 0,
                size_bytes: 4096,
                error: null,
                created_at: ready_at,
                completed_at: ready_at,
            },
            {
                id: 'snap-failed-old',
                audit_id: 'audit-1',
                sample_id: 'sample-a',
                requested_url: 'https://example.com',
                status: 'failed',
                page_title: 'Exempel',
                warning_count: 0,
                size_bytes: null,
                error: 'Navigation timeout of 30000 ms exceeded',
                created_at: failed_at,
                completed_at: failed_at,
            },
        ]);

        const items = await build_audit_snapshot_list('audit-1', [
            { id: 'sample-a', description: 'Startsida', url: 'https://example.com' },
        ]);

        expect(items).toHaveLength(1);
        expect(items[0].currentReady?.snapshotId).toBe('snap-ready');
        expect(items[0].pendingAttempt).toBeNull();
    });

    test('build_audit_snapshot_list utelämnar granskningsdel utan URL', async () => {
        const ready_at = new Date('2026-08-10T10:00:00.000Z');
        list_mock.mockResolvedValue([
            {
                id: 'snap-recurring',
                audit_id: 'audit-1',
                sample_id: 'sample-b',
                requested_url: 'https://old.example.com',
                status: 'ready',
                page_title: 'Gammal',
                warning_count: 0,
                size_bytes: 1024,
                error: null,
                created_at: ready_at,
                completed_at: ready_at,
            },
        ]);

        const items = await build_audit_snapshot_list('audit-1', [
            { id: 'sample-b', description: 'Sidfot', url: '' },
        ]);

        expect(items).toHaveLength(0);
    });

    test('build_audit_snapshot_list använder granskningsdelens URL före snapshot-URL', async () => {
        const ready_at = new Date('2026-08-10T10:00:00.000Z');
        list_mock.mockResolvedValue([
            {
                id: 'snap-ready',
                audit_id: 'audit-1',
                sample_id: 'sample-search',
                requested_url: 'https://www.apohem.se/produkt',
                status: 'ready',
                page_title: 'Produkt',
                warning_count: 0,
                size_bytes: 4096,
                error: null,
                created_at: ready_at,
                completed_at: ready_at,
            },
        ]);

        const items = await build_audit_snapshot_list('audit-1', [
            {
                id: 'sample-search',
                description: 'Sök efter tandkräm',
                url: 'https://www.apohem.se/sok?q=tandkr%C3%A4m',
            },
        ]);

        expect(items).toHaveLength(1);
        expect(items[0].requestedUrl).toBe('https://www.apohem.se/sok?q=tandkr%C3%A4m');
    });
});
