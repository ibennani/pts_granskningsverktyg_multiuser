/**
 * @fileoverview Enhetstester för semantisk HTML i PDF-export (krav).
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_report_pdf_html_document,
    build_report_pdf_intro_html,
    build_report_body_sorted_by_requirements,
    build_report_body_sorted_by_samples,
} from '../../js/export/export_report_html_criterias.ts';

function create_mock_audit_with_deficiency() {
    return {
        ruleFileContent: {
            metadata: {
                taxonomies: [{
                    id: 'wcag22-pour',
                    concepts: [{ id: 'perceivable', label: 'Perceivable' }],
                }],
            },
            requirements: {
                req1: {
                    id: 'req1',
                    key: 'req1',
                    title: 'Testkrav',
                    standardReference: { text: '1.1.1', url: 'https://example.com/1.1.1' },
                    classifications: [{ taxonomyId: 'wcag22-pour', conceptId: 'perceivable' }],
                    checks: [{
                        id: 'check1',
                        passCriteria: [{ id: 'pc1', requirement: 'Kravtext' }],
                    }],
                },
            },
        },
        samples: [{
            description: 'Granskningsdel ett',
            url: 'https://example.com/page',
            requirementResults: {
                req1: {
                    checkResults: {
                        check1: {
                            overallStatus: 'failed',
                            passCriteria: {
                                pc1: {
                                    status: 'failed',
                                    deficiencyId: 'B1',
                                    observationDetail: 'Observation **fet**',
                                    isStandardText: false,
                                },
                            },
                        },
                    },
                },
            },
        }],
    };
}

describe('export_report_html_criterias', () => {
    const t = (key: string) => key;

    test('intro innehåller h1 och semantiska stycken', () => {
        const intro = build_report_pdf_intro_html();
        expect(intro).toContain('<h1>Redovisning av granskningsresultatet</h1>');
        expect(intro).toContain('<p>');
    });

    test('dokument har lang och title', () => {
        const html = build_report_pdf_html_document({
            title: 'TEST Aktör',
            lang: 'sv',
            body_html: '<p>Innehåll</p>',
        });
        expect(html).toContain('<html lang="sv">');
        expect(html).toContain('<title>TEST Aktör</title>');
        expect(html).toContain("'Calibri'");
        expect(html).toContain('font-size: 16pt');
        expect(html).toContain('<main>');
    });

    test('krav med brist renderas med h2, metadata och observation', () => {
        const audit = create_mock_audit_with_deficiency();
        const body = build_report_body_sorted_by_requirements(audit, t);
        expect(body).toContain('<h2>1.1.1 Testkrav</h2>');
        expect(body).toContain('<strong>Referens: </strong>');
        expect(body).toContain('<strong>Principer: </strong>');
        expect(body).toContain('<strong>Identifierade brister: </strong>');
        expect(body).toContain('<h3>Granskningsdelar: <a href="https://example.com/page">Granskningsdel ett</a></h3>');
        expect(body).not.toContain('<strong>Granskningsdelar: </strong>');
        expect(body).toContain('<strong>Brist-id: 1 </strong>');
        expect(body).toContain('<strong>fet</strong>');
    });

    test('granskningsdel med brist renderas med h2 granskningsdel och h3 krav', () => {
        const audit = create_mock_audit_with_deficiency();
        const body = build_report_body_sorted_by_samples(audit, t);
        expect(body).toContain('<h2>Granskningsdelar: <a href="https://example.com/page">Granskningsdel ett</a></h2>');
        expect(body).toContain('<h3>1.1.1 Testkrav</h3>');
        expect(body).toContain('<strong>Brist-id: 1 </strong>');
    });
});
