import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const snapshot_api_path = path.join(spec_dir, '../../js/api/audit_snapshot_api.js');
const server_sync_path = path.join(spec_dir, '../../js/logic/server_sync.js');
const client_path = path.join(spec_dir, '../../js/api/client.js');
const retake_path = path.join(spec_dir, '../../js/logic/audit_sidrapport_retake.js');

const list_mock = jest.fn();
const sync_mock = jest.fn();
const retake_mock = jest.fn();

jest.unstable_mockModule(snapshot_api_path, () => ({
    list_audit_snapshots: list_mock,
}));

jest.unstable_mockModule(server_sync_path, () => ({
    sync_to_server_now: sync_mock,
}));

jest.unstable_mockModule(client_path, () => ({
    get_auth_token: () => 'token',
}));

jest.unstable_mockModule(retake_path, () => ({
    is_sidrapport_retake_in_progress: (row: { pendingAttempt?: { status: string } | null }) =>
        row.pendingAttempt?.status === 'capturing',
    start_sidrapport_retake_for_sample: retake_mock,
}));

const {
    should_queue_sidrapport_for_saved_sample,
    queue_sidrapport_after_sample_save,
} = await import('../../js/logic/queue_sidrapport_after_sample_save.ts');

const rule_file = {
    samples: {
        sampleCategories: [{ id: 'web', text: 'Webb', hasUrl: true, categories: [] }],
    },
};

function make_rule_file_content() {
    return { metadata: rule_file };
}

describe('queue_sidrapport_after_sample_save', () => {
    beforeEach(() => {
        list_mock.mockReset();
        sync_mock.mockReset();
        retake_mock.mockReset();
        sync_mock.mockResolvedValue(undefined);
        list_mock.mockResolvedValue({ items: [] });
        retake_mock.mockResolvedValue(undefined);
    });

    test('should_queue_sidrapport_for_saved_sample kräver URL och kategori med URL', () => {
        expect(
            should_queue_sidrapport_for_saved_sample(
                { sampleId: 's1', url: 'https://example.com', sampleCategory: 'web' },
                rule_file
            )
        ).toBe(true);
        expect(
            should_queue_sidrapport_for_saved_sample(
                { sampleId: 's1', url: '', sampleCategory: 'web' },
                rule_file
            )
        ).toBe(false);
        expect(
            should_queue_sidrapport_for_saved_sample(
                { sampleId: 's1', url: 'https://example.com', sampleCategory: 'pdf' },
                rule_file
            )
        ).toBe(false);
    });

    test('queue_sidrapport_after_sample_save startar capture i bakgrunden', async () => {
        await queue_sidrapport_after_sample_save(
            {
                getState: () => ({ auditId: 'audit-1', ruleFileContent: make_rule_file_content() }),
                dispatch: jest.fn(),
            },
            {
                sampleId: 's1',
                url: 'https://example.com',
                sampleCategory: 'web',
                attachedMediaFilenames: ['shot.png'],
            }
        );

        expect(sync_mock).toHaveBeenCalled();
        expect(list_mock).toHaveBeenCalledWith('audit-1');
        expect(retake_mock).toHaveBeenCalledWith(
            'audit-1',
            expect.objectContaining({ id: 's1', url: 'https://example.com' }),
            'https://example.com'
        );
    });

    test('hoppar över om sidrapport redan pågår', async () => {
        list_mock.mockResolvedValue({
            items: [
                {
                    sampleId: 's1',
                    pendingAttempt: { status: 'capturing' },
                },
            ],
        });

        await queue_sidrapport_after_sample_save(
            {
                getState: () => ({ auditId: 'audit-1', ruleFileContent: make_rule_file_content() }),
                dispatch: jest.fn(),
            },
            {
                sampleId: 's1',
                url: 'https://example.com',
                sampleCategory: 'web',
            }
        );

        expect(retake_mock).not.toHaveBeenCalled();
    });
});
