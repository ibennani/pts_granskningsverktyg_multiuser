/**
 * @fileoverview Tester för zip-filnamn för alla bilagor.
 */
import { describe, test, expect } from '@jest/globals';
import { build_all_appendices_zip_filename } from '../../js/export/export_report_filename.ts';

describe('build_all_appendices_zip_filename', () => {
    const t = (key: string) => {
        if (key === 'filename_fallback_actor') return 'Okand_aktör';
        if (key === 'audit_actions_all_appendices_zip_filename_suffix') return 'alla_bilagor';
        return key;
    };

    test('bygger [dnr]_[aktör]_alla_bilagor.zip', () => {
        expect(build_all_appendices_zip_filename({
            auditMetadata: { caseNumber: 'PTS-2024/1', actorName: 'Exempel AB' },
        }, t)).toBe('PTS-20241_Exempel_AB_alla_bilagor.zip');
    });

    test('bygger aktör och suffix utan diarienummer', () => {
        expect(build_all_appendices_zip_filename({
            auditMetadata: { actorName: 'Exempel AB' },
        }, t)).toBe('Exempel_AB_alla_bilagor.zip');
    });
});
