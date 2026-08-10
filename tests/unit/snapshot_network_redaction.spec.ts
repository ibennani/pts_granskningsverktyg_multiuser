import {
    is_blocked_network_header,
    sanitize_response_headers,
    build_network_json,
} from '../../server/snapshots/network_redaction.ts';

describe('snapshot_network_redaction', () => {
    test('is_blocked_network_header blockerar känsliga headers', () => {
        expect(is_blocked_network_header('Cookie')).toBe(true);
        expect(is_blocked_network_header('Set-Cookie')).toBe(true);
        expect(is_blocked_network_header('Authorization')).toBe(true);
        expect(is_blocked_network_header('Content-Type')).toBe(false);
    });

    test('sanitize_response_headers tar bort cookie och authorization', () => {
        const safe = sanitize_response_headers({
            'Content-Type': 'text/html',
            Cookie: 'session=secret',
            Authorization: 'Bearer token',
        });
        expect(safe).toEqual({ 'Content-Type': 'text/html' });
    });

    test('build_network_json räknar misslyckade requests', () => {
        const result = build_network_json([
            {
                url: 'https://example.com',
                method: 'GET',
                resourceType: 'Document',
                mimeType: 'text/html',
                status: 200,
                timingMs: null,
                encodedSize: 100,
                decodedSize: 100,
                failed: false,
                failureReason: null,
                redirectChain: [],
                responseHeaders: {},
                bodyCaptured: true,
                bodySkipReason: null,
                originalArchivePath: null,
            },
            {
                url: 'https://example.com/missing.js',
                method: 'GET',
                resourceType: 'Script',
                mimeType: null,
                status: null,
                timingMs: null,
                encodedSize: null,
                decodedSize: null,
                failed: true,
                failureReason: 'net::ERR_FAILED',
                redirectChain: [],
                responseHeaders: {},
                bodyCaptured: false,
                bodySkipReason: 'failed',
                originalArchivePath: null,
            },
        ]);
        expect(result.failedRequestCount).toBe(1);
        expect(result.resources).toHaveLength(2);
    });
});
