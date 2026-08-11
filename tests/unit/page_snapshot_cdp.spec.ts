import { describe, test, expect } from '@jest/globals';
import {
    is_resource_body_capture_candidate,
    push_body_unavailable_warning,
    push_resource_too_large_warning,
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
