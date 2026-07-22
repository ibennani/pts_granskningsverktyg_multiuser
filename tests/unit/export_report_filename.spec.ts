/**
 * @fileoverview Tester för gemensam exportfilnamnslogik (bilagor).
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_all_appendices_zip_filename,
    build_appendix1_summary_pdf_filename,
    build_appendix2_export_filename,
    build_screenshots_appendix_pdf_filename,
} from '../../js/export/export_report_filename.ts';

describe('export_report_filename bilagor', () => {
    const audit = {
        auditMetadata: { caseNumber: '25-20478', actorName: 'NetOnNet AB' },
    };

    const t = (key: string) => {
        if (key === 'filename_fallback_actor') return 'Okand_aktör';
        return key;
    };

    test('bilaga 1 PDF', () => {
        expect(build_appendix1_summary_pdf_filename(audit, t)).toBe(
            '25-20478_NetOnNet_AB_bilaga_1_sammanfattning.pdf'
        );
    });

    test('bilaga 2 Excel', () => {
        expect(build_appendix2_export_filename(audit, 'xlsx', t)).toBe(
            '25-20478_NetOnNet_AB_bilaga_2_protokoll.xlsx'
        );
    });

    test('bilaga 3 PDF', () => {
        expect(build_screenshots_appendix_pdf_filename(audit, t)).toBe(
            '25-20478_NetOnNet_AB_bilaga_3_skarmbilder.pdf'
        );
    });

    test('zip med alla bilagor', () => {
        expect(build_all_appendices_zip_filename(audit, t)).toBe(
            '25-20478_NetOnNet_AB_alla_bilagor.zip'
        );
    });

    test('bilaga 1 PDF inkluderar granskningstyp i filnamn', () => {
        const audit_with_type = {
            auditMetadata: {
                caseNumber: '25-20478',
                actorName: 'NetOnNet AB',
                auditTypeId: 'tillsyn-lptt',
                auditTypeLabel: 'Tillsyn LPTT',
            },
            ruleFileContent: {
                metadata: {
                    auditTypes: [{ id: 'tillsyn-lptt', label: 'Tillsyn LPTT', taxonomyId: 'wcag22-pour' }],
                },
            },
        };
        expect(build_appendix1_summary_pdf_filename(audit_with_type, t)).toBe(
            '25-20478_NetOnNet_AB_Tillsyn_LPTT_bilaga_1_sammanfattning.pdf'
        );
    });

    test('bilaga 1 PDF använder sparad etikett när typ saknas i regelfil', () => {
        const audit_with_type = {
            auditMetadata: {
                caseNumber: '25-20478',
                actorName: 'NetOnNet AB',
                auditTypeId: 'borttagen',
                auditTypeLabel: 'Tillsyn LPTT',
            },
            ruleFileContent: {
                metadata: {
                    auditTypes: [{ id: 'tillsyn-lptt', label: 'Tillsyn LPTT', taxonomyId: 'wcag22-pour' }],
                },
            },
        };
        expect(build_appendix1_summary_pdf_filename(audit_with_type, t)).toBe(
            '25-20478_NetOnNet_AB_Tillsyn_LPTT_bilaga_1_sammanfattning.pdf'
        );
    });
});
