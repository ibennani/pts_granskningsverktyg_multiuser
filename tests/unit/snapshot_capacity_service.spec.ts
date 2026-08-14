import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const repository_path = path.join(spec_dir, '../../server/repositories/audit_snapshot_repository.js');
const config_path = path.join(spec_dir, '../../server/snapshots/audit_snapshot_config.js');
const metrics_path = path.join(spec_dir, '../../server/services/snapshot_job_queue_metrics.js');

const count_mock = jest.fn();

jest.unstable_mockModule(repository_path, () => ({
    count_snapshot_processing_rows: count_mock,
}));

jest.unstable_mockModule(config_path, () => ({
    get_snapshot_browser_max_concurrency: () => 8,
}));

jest.unstable_mockModule(metrics_path, () => ({
    get_in_memory_queue_length: () => 2,
    get_memory_queue_position: (capture_id: string) =>
        capture_id === 'capture-2' ? 2 : null,
}));

const { build_snapshot_capacity, build_snapshot_capture_queue_info } = await import(
    '../../server/services/snapshot_capacity_service.ts'
);

describe('snapshot_capacity_service', () => {
    beforeEach(() => {
        count_mock.mockReset();
    });

    test('build_snapshot_capacity summerar aktiv och kö', async () => {
        count_mock.mockResolvedValue({
            queued_count: 3,
            capturing_count: 2,
            packaging_count: 1,
            active_audit_count: 2,
            active_user_count: 2,
        });

        const capacity = await build_snapshot_capacity();
        expect(capacity.max_browser_slots).toBe(8);
        expect(capacity.active_count).toBe(3);
        expect(capacity.queued_count).toBe(3);
        expect(capacity.memory_queue_length).toBe(2);
    });

    test('build_snapshot_capture_queue_info ger köposition', async () => {
        count_mock.mockResolvedValue({
            queued_count: 2,
            capturing_count: 1,
            packaging_count: 0,
            active_audit_count: 1,
            active_user_count: 1,
        });

        const info = await build_snapshot_capture_queue_info('capture-2');
        expect(info.position).toBe(2);
        expect(info.active_count).toBe(1);
        expect(info.queued_count).toBe(2);
    });
});
