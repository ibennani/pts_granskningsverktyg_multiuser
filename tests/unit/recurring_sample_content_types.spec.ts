/**
 * @fileoverview Enhetstester för recurring_sample_content_types.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const snapshot_api_path = path.join(spec_dir, '../../js/api/audit_snapshot_api.js');

const fetch_summary_mock = jest.fn<typeof import('../../js/api/audit_snapshot_api.js').fetch_snapshot_analysis_summary>();

jest.unstable_mockModule(snapshot_api_path, () => ({
    fetch_snapshot_analysis_summary: fetch_summary_mock,
}));

const { resolve_recurring_sample_content_type_ids } = await import(
    '../../js/logic/recurring_sample_content_types.ts'
);

const metadata = {
    contentTypes: [
        {
            types: [
                { id: 'nav-lankar', text: 'Länkar', defaultSelected: true },
                { id: 'bilder', text: 'Bilder', defaultSelected: true },
            ],
        },
    ],
};

describe('recurring_sample_content_types', () => {
    beforeEach(() => {
        fetch_summary_mock.mockReset();
    });

    test('utan evidens returneras förvalda innehållstyper', async () => {
        const ids = await resolve_recurring_sample_content_type_ids('audit-1', metadata, []);
        expect(ids).toEqual(['nav-lankar', 'bilder']);
        expect(fetch_summary_mock).not.toHaveBeenCalled();
    });

    test('slår ihop sidrapport per evidens och tar skärning över sidor', async () => {
        fetch_summary_mock
            .mockResolvedValueOnce({
                contentTypes: { data: { detectedContentTypeIds: ['nav-lankar', 'formular'] } },
            })
            .mockResolvedValueOnce({
                contentTypes: { data: { detectedContentTypeIds: ['nav-lankar', 'tabell'] } },
            });

        const ids = await resolve_recurring_sample_content_type_ids('audit-1', metadata, [
            'cap-1',
            'cap-2',
        ]);

        expect(fetch_summary_mock).toHaveBeenCalledTimes(2);
        expect(ids).toEqual(['nav-lankar', 'bilder']);
    });
});
