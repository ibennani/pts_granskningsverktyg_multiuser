import {
    build_screenshots_appendix_body_html,
} from '../../js/export/export_report_html_screenshots_appendix.ts';
import { build_report_pdf_print_css } from '../../js/export/export_report_typography.ts';
import { format_screenshots_appendix_display_filename } from '../../js/export/export_screenshots_appendix_media.ts';
import { normalize_rulefile_appendix3 } from '../../js/logic/appendix3_screenshots_template.ts';

describe('export_report_html_screenshots_appendix appendix3 template', () => {
    const t = (key: string) => key;

    test('build_screenshots_appendix_body_html använder fast rubrik och intro från regelfil', () => {
        const audit = {
            ruleFileContent: normalize_rulefile_appendix3({
                appendix3: {
                    introText: 'Intro **markdown**.',
                },
            }),
            auditMetadata: { caseNumber: 'DNR-99', actorName: 'Test' },
        };
        const html = build_screenshots_appendix_body_html([], audit, t);
        expect(html).toContain('Bilaga 3: DNR-99 Test');
        expect(html).toContain('<strong>markdown</strong>');
    });

    test('bildrubriker visar filnamn utan media-prefix och ligger i screenshots-appendix', () => {
        const audit = {
            ruleFileContent: normalize_rulefile_appendix3({}),
            auditMetadata: { caseNumber: 'DNR-99', actorName: 'Test' },
        };
        const html = build_screenshots_appendix_body_html(
            [
                {
                    export_filename: 'media/047_1_WEBB_1_2026-04-11_26-11111.png',
                    original_filename: 'skarm.png',
                    bytes: new ArrayBuffer(0),
                    mime_type: 'image/png',
                    docx_image_type: 'png',
                    display_width_px: 100,
                    display_height_px: 80,
                    max_height_cm: 24.5,
                    scaled_for_page_fit: false,
                    pdf_data_uri: 'data:image/png;base64,AA==',
                },
            ],
            audit,
            t
        );

        expect(html).toContain('<div class="screenshots-appendix">');
        expect(html).toContain('<div class="screenshots-appendix__item">');
        expect(html).toContain('<h2>047_1_WEBB_1_2026-04-11_26-11111.png</h2>');
        expect(html).not.toContain('media/047_1_WEBB_1_2026-04-11_26-11111.png');
        expect(html).toContain('alt="047_1_WEBB_1_2026-04-11_26-11111.png"');
    });

    test('print-CSS vänsterställer bildrubriker i bilaga 3', () => {
        const css = build_report_pdf_print_css();
        expect(css).toMatch(/\.screenshots-appendix h2[\s\S]*text-align:\s*left/);
    });
});

describe('format_screenshots_appendix_display_filename', () => {
    test('tar bort media-prefix', () => {
        expect(format_screenshots_appendix_display_filename('media/047_1_WEBB_1_2026-04-11_26-11111.png')).toBe(
            '047_1_WEBB_1_2026-04-11_26-11111.png'
        );
    });

    test('lämnar filnamn utan prefix oförändrat', () => {
        expect(format_screenshots_appendix_display_filename('047_1_WEBB_1_2026-04-11_26-11111.png')).toBe(
            '047_1_WEBB_1_2026-04-11_26-11111.png'
        );
    });
});
