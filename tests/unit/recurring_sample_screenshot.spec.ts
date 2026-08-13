/**
 * @fileoverview Enhetstester för recurring_sample_screenshot.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const api_path = path.join(spec_dir, '../../js/api/audit_snapshot_api.js');

const create_mock = jest.fn<typeof import('../../js/api/audit_snapshot_api.js').create_recurring_block_screenshot>();

jest.unstable_mockModule(api_path, () => ({
    create_recurring_block_screenshot: create_mock,
}));

const { resolve_recurring_sample_screenshot_filename } = await import(
    '../../js/logic/recurring_sample_screenshot.ts'
);

describe('recurring_sample_screenshot', () => {
    beforeEach(() => {
        create_mock.mockReset();
    });

    test('returnerar första lyckade filnamn', async () => {
        create_mock
            .mockResolvedValueOnce({ filename: null, skipped: true })
            .mockResolvedValueOnce({ filename: 'sidhuvud_aterkommande.png', skipped: false });

        const filename = await resolve_recurring_sample_screenshot_filename('audit-1', {
            label: 'Sidhuvud',
            candidateType: 'header',
            structureFingerprint: 'fp-1',
            captureIds: ['cap-1', 'cap-2'],
        });

        expect(filename).toBe('sidhuvud_aterkommande.png');
        expect(create_mock).toHaveBeenCalledTimes(2);
    });
});
