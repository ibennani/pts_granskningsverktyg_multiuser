/**
 * @fileoverview Enhetstester för registrering av granskningsdel före bulk-capture.
 */
import { describe, test, expect, jest } from '@jest/globals';
import {
    ensure_bulk_import_sample_on_server,
    remove_bulk_import_stub_sample,
} from '../../js/logic/bulk_url_import_sample_register.ts';

describe('bulk_url_import_sample_register', () => {
    test('lägger till granskningsdel och synkar innan capture', async () => {
        const dispatch = jest.fn();
        const sync_to_server_now = jest.fn(() => Promise.resolve());
        const getState = jest.fn(() => ({
            auditId: 'audit-1',
            samples: [] as Array<{ id: string }>,
        }));

        const row = await ensure_bulk_import_sample_on_server(
            {
                getState,
                dispatch,
                StoreActionTypes: { ADD_SAMPLE: 'ADD_SAMPLE', DELETE_SAMPLE: 'DELETE_SAMPLE' },
                generate_uuid: () => 'sample-new',
                sync_to_server_now,
            },
            { row_id: 'row-1', url: 'https://example.com', sample_id: null },
            'cat-web'
        );

        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'ADD_SAMPLE',
                payload: expect.objectContaining({
                    id: 'sample-new',
                    url: 'https://example.com',
                    skip_render: true,
                }),
            })
        );
        expect(sync_to_server_now).toHaveBeenCalledTimes(1);
        expect(row.sample_id).toBe('sample-new');
    });

    test('tar bort stub vid misslyckad hämtning', async () => {
        const dispatch = jest.fn();
        const sync_to_server_now = jest.fn(() => Promise.resolve());
        const getState = jest.fn(() => ({
            auditId: 'audit-1',
            samples: [{ id: 'sample-new' }],
        }));

        await remove_bulk_import_stub_sample(
            {
                getState,
                dispatch,
                StoreActionTypes: { ADD_SAMPLE: 'ADD_SAMPLE', DELETE_SAMPLE: 'DELETE_SAMPLE' },
                generate_uuid: () => 'unused',
                sync_to_server_now,
            },
            'sample-new'
        );

        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'DELETE_SAMPLE',
                payload: { sampleId: 'sample-new', skip_render: true },
            })
        );
        expect(sync_to_server_now).toHaveBeenCalledTimes(1);
    });
});
