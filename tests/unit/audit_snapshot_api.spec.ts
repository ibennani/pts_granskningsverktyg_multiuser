import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(spec_dir, '../../js/api/client.js');
const api_path = path.join(spec_dir, '../../js/api/audit_snapshot_api.ts');

const fetch_mock = jest.fn();
const get_auth_token_mock = jest.fn(() => 'token');
const refresh_auth_token_mock = jest.fn(async () => false);

jest.unstable_mockModule(client_path, () => ({
    get_base_url: () => '/api',
    get_auth_token: get_auth_token_mock,
    refresh_auth_token: refresh_auth_token_mock,
}));

const {
    start_audit_snapshot_capture,
    get_audit_snapshot_download_url,
    get_audit_snapshots_download_all_url,
} = await import(api_path);

describe('audit_snapshot_api URL:er', () => {
    beforeEach(() => {
        fetch_mock.mockReset();
        global.fetch = fetch_mock as unknown as typeof fetch;
    });

    test('start_audit_snapshot_capture anropar /api/audits/:id/snapshots/capture', async () => {
        fetch_mock.mockResolvedValue({
            ok: true,
            json: async () => ({
                captureId: 'cap-1',
                snapshotStatus: 'capturing',
                pageTitle: { outcome: 'success', value: 'Titel' },
                screenshot: { outcome: 'success', filename: 'a.png' },
            }),
        });

        await start_audit_snapshot_capture('audit-1', {
            captureId: 'cap-1',
            sampleId: 'sample-1',
            url: 'https://example.com',
        });

        expect(fetch_mock).toHaveBeenCalledTimes(1);
        const [url] = fetch_mock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/audits/audit-1/snapshots/capture');
    });

    test('download-URL:er inkluderar /api/-prefix', () => {
        expect(get_audit_snapshot_download_url('audit-1', 'snap-1')).toBe(
            '/api/audits/audit-1/snapshots/snap-1/download'
        );
        expect(get_audit_snapshots_download_all_url('audit-1')).toBe(
            '/api/audits/audit-1/snapshots/download-all'
        );
    });

    test('start_audit_snapshot_capture plockar ut Express HTML-fel som detail', async () => {
        fetch_mock.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: async () =>
                '<!DOCTYPE html><html><body><pre>Cannot POST /apiaudits/audit-1/snapshots/capture</pre></body></html>',
        });

        await expect(
            start_audit_snapshot_capture('audit-1', {
                captureId: 'cap-1',
                sampleId: 'sample-1',
                url: 'https://example.com',
            })
        ).rejects.toThrow('Cannot POST /apiaudits/audit-1/snapshots/capture');
    });
});
