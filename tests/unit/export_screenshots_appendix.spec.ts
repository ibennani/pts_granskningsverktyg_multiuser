import {
    build_screenshots_appendix_body_html,
} from '../../js/export/export_report_html_screenshots_appendix.ts';
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
});
