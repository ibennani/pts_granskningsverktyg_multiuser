import { describe, test, expect, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
    is_resource_body_capture_candidate,
    push_body_unavailable_warning,
    push_resource_too_large_warning,
    decode_cdp_response_body,
    create_network_capture_state,
    persist_resource_bodies,
} from '../../server/snapshots/page_snapshot_cdp.ts';
import {
    dedupe_sidrapport_warnings_for_display,
} from '../../js/utils/sidrapport_warning_labels.ts';

describe('page_snapshot_cdp helpers', () => {
    test('is_resource_body_capture_candidate inkluderar huvuddokument', () => {
        expect(
            is_resource_body_capture_candidate(
                {
                    failed: false,
                    requestId: 'doc-1',
                    mimeType: 'text/html',
                    resourceType: 'Document',
                },
                'doc-1'
            )
        ).toBe(true);
    });

    test('is_resource_body_capture_candidate inkluderar css och js', () => {
        expect(
            is_resource_body_capture_candidate(
                {
                    failed: false,
                    requestId: 'css-1',
                    mimeType: 'text/css',
                    resourceType: 'Stylesheet',
                },
                'doc-1'
            )
        ).toBe(true);
        expect(
            is_resource_body_capture_candidate(
                {
                    failed: false,
                    requestId: 'js-1',
                    mimeType: 'application/javascript',
                    resourceType: 'Script',
                },
                'doc-1'
            )
        ).toBe(true);
    });

    test('is_resource_body_capture_candidate hoppar över bilder', () => {
        expect(
            is_resource_body_capture_candidate(
                {
                    failed: false,
                    requestId: 'img-1',
                    mimeType: 'image/png',
                    resourceType: 'Image',
                },
                'doc-1'
            )
        ).toBe(false);
    });

    test('is_resource_body_capture_candidate inkluderar Document utan main id', () => {
        expect(
            is_resource_body_capture_candidate(
                {
                    failed: false,
                    requestId: 'doc-early',
                    mimeType: null,
                    resourceType: 'Document',
                },
                null
            )
        ).toBe(true);
    });

    test('decode_cdp_response_body hanterar text och base64', () => {
        expect(decode_cdp_response_body({ body: 'hej', base64Encoded: false }).toString('utf8')).toBe(
            'hej'
        );
        expect(
            decode_cdp_response_body({
                body: Buffer.from('abc', 'utf8').toString('base64'),
                base64Encoded: true,
            }).toString('utf8')
        ).toBe('abc');
    });

    test('persist_resource_bodies skriver från pendingBodyBytes utan CDP-anrop', async () => {
        const temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-cdp-'));
        const state = create_network_capture_state();
        state.mainDocumentRequestId = 'doc-1';
        state.resources.push({
            requestId: 'js-1',
            url: 'https://example.com/app.js',
            method: 'GET',
            resourceType: 'Script',
            mimeType: 'application/javascript',
            status: 200,
            encodedSize: 12,
            decodedSize: null,
            failed: false,
            failureReason: null,
            redirectChain: [],
            responseHeaders: {},
            bodyCaptured: false,
            bodySkipReason: null,
            archiveRelativePath: null,
            pendingBodyBytes: Buffer.from('console.log(1);', 'utf8'),
        });

        const cdp = { send: jest.fn() };
        const result = await persist_resource_bodies(
            cdp as never,
            state,
            temp_dir
        );

        expect(cdp.send).not.toHaveBeenCalled();
        expect(result.body_unavailable_count).toBe(0);
        expect(state.resources[0]?.bodyCaptured).toBe(true);
        const written = await fs.readFile(
            path.join(temp_dir, 'resources/scripts/resource-0000.js'),
            'utf8'
        );
        expect(written).toBe('console.log(1);');
        await fs.rm(temp_dir, { recursive: true, force: true });
    });

    test('persist_resource_bodies räknar inte dubbelt när eager redan misslyckat', async () => {
        const temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-cdp-'));
        const state = create_network_capture_state();
        state.resources.push({
            requestId: 'js-1',
            url: 'https://example.com/app.js',
            method: 'GET',
            resourceType: 'Script',
            mimeType: 'application/javascript',
            status: 200,
            encodedSize: 12,
            decodedSize: null,
            failed: false,
            failureReason: null,
            redirectChain: [],
            responseHeaders: {},
            bodyCaptured: false,
            bodySkipReason: 'network response body no longer available',
            archiveRelativePath: null,
            pendingBodyBytes: null,
        });

        const cdp = { send: jest.fn() };
        const result = await persist_resource_bodies(cdp as never, state, temp_dir);

        expect(cdp.send).not.toHaveBeenCalled();
        expect(result.body_unavailable_count).toBe(1);
        await fs.rm(temp_dir, { recursive: true, force: true });
    });

    test('push_body_unavailable_warning lägger till en varning', () => {
        const warnings: Array<{ code: string; message: string }> = [];
        push_body_unavailable_warning(warnings, 3);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]?.code).toBe('body_unavailable');
    });

    test('push_resource_too_large_warning lägger till en varning', () => {
        const warnings: Array<{ code: string; message: string }> = [];
        push_resource_too_large_warning(warnings, 2);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]?.code).toBe('resource_too_large');
    });
});

describe('dedupe_sidrapport_warnings_for_display', () => {
    test('visar varje kod högst en gång', () => {
        const deduped = dedupe_sidrapport_warnings_for_display([
            { code: 'body_unavailable', message: 'a' },
            { code: 'body_unavailable', message: 'b' },
            { code: 'source_html_unavailable', message: 'c' },
        ]);
        expect(deduped).toHaveLength(2);
        expect(deduped.map((w) => w.code)).toEqual([
            'body_unavailable',
            'source_html_unavailable',
        ]);
    });
});
