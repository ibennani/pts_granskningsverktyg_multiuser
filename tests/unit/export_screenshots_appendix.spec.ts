import { jest } from '@jest/globals';
import {
    collect_screenshots_appendix_entries_sync,
    has_screenshots_appendix_images,
} from '../../js/export/export_screenshots_appendix_collect.ts';
import { build_screenshots_appendix_body_html, build_screenshots_appendix_pdf_document_chunks } from '../../js/export/export_report_html_screenshots_appendix.ts';
import {
    build_screenshots_appendix_pdf_filename,
    build_screenshots_appendix_word_filename,
} from '../../js/export/export_report_filename.ts';
import { compute_screenshots_appendix_display_size } from '../../js/export/export_screenshots_appendix_media.ts';
import { append_word_screenshots_appendix_paragraphs } from '../../js/export/export_word_screenshots_appendix.ts';
import { Paragraph } from 'docx';

const t = (key: string) => {
    const labels: Record<string, string> = {
        export_screenshots_appendix_title: 'Bilaga 3 Skärmbilder',
        export_screenshots_appendix_empty: 'Inga skärmbilder.',
        screenshots_appendix_export_filename_label: 'Bilaga 3 Skärmbilder',
        filename_fallback_actor: 'PTS AB',
    };
    return labels[key] ?? key;
};

function create_audit_with_media() {
    return {
        auditMetadata: { actorName: 'PTS AB', caseNumber: '2024-123' },
        ruleFileContent: {
            requirements: {
                req1: {
                    key: 'req1',
                    checks: [{ id: 'chk1', passCriteria: [{ id: 'pc1', requirement: 'Krav' }] }],
                },
            },
        },
        samples: [
            {
                id: 's1',
                attachedMediaFilenames: ['stickprov.png'],
                requirementResults: {
                    req1: {
                        checkResults: {
                            chk1: {
                                passCriteria: {
                                    pc1: {
                                        status: 'failed',
                                        deficiencyId: 'B047',
                                        attachedMediaFilenames: ['brist.png', 'video.mp4'],
                                    },
                                },
                            },
                        },
                    },
                },
            },
        ],
    };
}

describe('export_screenshots_appendix_collect', () => {
    test('filtrerar bort video och behåller previewable bilder', () => {
        const entries = collect_screenshots_appendix_entries_sync(create_audit_with_media(), null);
        const originals = entries.map((entry) => entry.original_filename);
        expect(originals).toContain('brist.png');
        expect(originals).toContain('stickprov.png');
        expect(originals).not.toContain('video.mp4');
    });

    test('has_screenshots_appendix_images är true när bilder finns', () => {
        expect(has_screenshots_appendix_images(create_audit_with_media())).toBe(true);
        expect(has_screenshots_appendix_images({ samples: [] })).toBe(false);
    });
});

describe('export_screenshots_appendix_media', () => {
    test('compute_screenshots_appendix_display_size skalar ned stor bild', () => {
        const large = compute_screenshots_appendix_display_size(4000, 3000);
        expect(large.width_px).toBeLessThan(4000);
        expect(large.height_px).toBeLessThan(3000);
        expect(large.scaled_for_page_fit).toBe(true);
    });

    test('compute_screenshots_appendix_display_size behåller liten bild i full storlek', () => {
        const small = compute_screenshots_appendix_display_size(200, 150);
        expect(small.width_px).toBe(200);
        expect(small.height_px).toBe(150);
        expect(small.scaled_for_page_fit).toBe(false);
    });
});

describe('export_report_filename screenshots appendix', () => {
    test('build_screenshots_appendix_pdf_filename använder mellanslag och datum', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-24T10:00:00.000Z'));
        const filename = build_screenshots_appendix_pdf_filename(
            { auditMetadata: { actorName: 'PTS AB', caseNumber: '2024-123' } },
            t
        );
        expect(filename).toBe('2024-123 PTS AB Bilaga 3 Skärmbilder 2026-06-24.pdf');
        jest.useRealTimers();
    });

    test('build_screenshots_appendix_word_filename utan diarienummer', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-24T10:00:00.000Z'));
        const filename = build_screenshots_appendix_word_filename(
            { auditMetadata: { actorName: 'PTS AB' } },
            t
        );
        expect(filename).toBe('PTS AB Bilaga 3 Skärmbilder 2026-06-24.docx');
        jest.useRealTimers();
    });
});

describe('export_report_html_screenshots_appendix', () => {
    test('build_screenshots_appendix_body_html renderar endast h1, h2 och img', () => {
        const audit = { auditMetadata: { actorName: 'PTS AB', caseNumber: '2024-123' } };
        const items = [
            {
                export_filename: '047_1_WEBB_1_2026-04-11_26-11111.png',
                original_filename: 'brist.png',
                bytes: new Uint8Array([137, 80, 78, 71]).buffer,
                mime_type: 'image/png',
                docx_image_type: 'png' as const,
                display_width_px: 400,
                display_height_px: 300,
                max_height_cm: 24.5,
                scaled_for_page_fit: false,
                pdf_data_uri: 'data:image/jpeg;base64,/9j/4AAQ',
            },
        ];
        const html = build_screenshots_appendix_body_html(items, audit, t);
        expect(html).toContain('<h1>2024-123 PTS AB</h1>');
        expect(html).toContain('<h2>047_1_WEBB_1_2026-04-11_26-11111.png</h2>');
        expect(html).toContain('alt="047_1_WEBB_1_2026-04-11_26-11111.png"');
        expect(html).toContain('data:image/jpeg;base64,');
        expect(html).not.toContain('<main');
        expect(html).not.toContain('<section');
        expect(html).not.toContain('<figure');
    });

    test('build_screenshots_appendix_pdf_document_chunks delar upp h1 och h2-bildpar', () => {
        const items = [
            {
                export_filename: 'a.png',
                original_filename: 'a.png',
                bytes: new Uint8Array([137, 80, 78, 71]).buffer,
                mime_type: 'image/png',
                docx_image_type: 'png' as const,
                display_width_px: 400,
                display_height_px: 300,
                max_height_cm: 24.5,
                scaled_for_page_fit: false,
                pdf_data_uri: 'data:image/jpeg;base64,/9j/4AAQ',
            },
            {
                export_filename: 'b.png',
                original_filename: 'b.png',
                bytes: new Uint8Array([137, 80, 78, 71]).buffer,
                mime_type: 'image/png',
                docx_image_type: 'png' as const,
                display_width_px: 400,
                display_height_px: 300,
                max_height_cm: 24.5,
                scaled_for_page_fit: false,
                pdf_data_uri: 'data:image/jpeg;base64,/9j/4AAQ',
            },
            {
                export_filename: 'c.png',
                original_filename: 'c.png',
                bytes: new Uint8Array([137, 80, 78, 71]).buffer,
                mime_type: 'image/png',
                docx_image_type: 'png' as const,
                display_width_px: 400,
                display_height_px: 300,
                max_height_cm: 24.5,
                scaled_for_page_fit: false,
                pdf_data_uri: 'data:image/jpeg;base64,/9j/4AAQ',
            },
        ];
        const chunks = build_screenshots_appendix_pdf_document_chunks(
            { auditMetadata: { actorName: 'NetOnNet' } },
            items,
            t
        );
        expect(chunks.length).toBe(3);
        expect(chunks[0]).toContain('<h1>NetOnNet</h1>');
        expect(chunks[0]).not.toContain('<main');
        expect(chunks[1]).toContain('<h2>a.png</h2>');
        expect(chunks[1]).toContain('alt="a.png"');
        expect(chunks[1]).toContain('<h2>b.png</h2>');
        expect(chunks[2]).toContain('<h2>c.png</h2>');
        expect(chunks[2]).toContain('alt="c.png"');
    });
});

describe('export_word_screenshots_appendix', () => {
    test('append_word_screenshots_appendix_paragraphs bygger h1 och h2+bildblock', () => {
        const items = [
            {
                export_filename: '047_1_WEBB_1_2026-04-11_26-11111.png',
                original_filename: 'brist.png',
                bytes: new Uint8Array([137, 80, 78, 71]).buffer,
                mime_type: 'image/png',
                docx_image_type: 'png' as const,
                display_width_px: 400,
                display_height_px: 300,
                max_height_cm: 24.5,
            },
        ];
        const children: unknown[] = [];
        append_word_screenshots_appendix_paragraphs(children, items, t);
        expect(children.length).toBe(3);
        expect(children.every((child) => child instanceof Paragraph)).toBe(true);
    });
});
