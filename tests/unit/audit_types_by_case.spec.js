import { normalize_media_kind, resolve_target_type_id_for_case } from '../../scripts/lib/audit_media_kind.mjs';
import { build_case_type_plan } from '../../scripts/lib/audit_types_by_case.mjs';

describe('audit_media_kind', () => {
    test('normalize_media_kind känner igen pdf och webb', () => {
        expect(normalize_media_kind({ metadata: { monitoringType: { type: 'pdf' } } })).toBe('pdf');
        expect(normalize_media_kind({ metadata: { monitoringType: { type: 'web' } } })).toBe('webb');
    });

    test('resolve_target_type_id_for_case väljer marknad vid pdf i ärendet', () => {
        expect(resolve_target_type_id_for_case(['webb', 'pdf'])).toBe('marknadskontroll-lptt');
        expect(resolve_target_type_id_for_case(['webb', 'webb'])).toBe('tillsyn-lptt');
    });
});

describe('build_case_type_plan', () => {
    test('sätter marknadskontroll för hela ärendet vid blandade media', () => {
        const plan = build_case_type_plan([
            {
                id: 'a1',
                metadata: { caseNumber: '25-1' },
                rule_file_content: { metadata: { monitoringType: { type: 'web' } } },
            },
            {
                id: 'a2',
                metadata: { caseNumber: '25-1' },
                rule_file_content: { metadata: { monitoringType: { type: 'pdf' } } },
            },
            {
                id: 'b1',
                metadata: { caseNumber: '25-2' },
                rule_file_content: { metadata: { monitoringType: { type: 'web' } } },
            },
        ]);

        expect(plan.get('25-1')?.target_type_id).toBe('marknadskontroll-lptt');
        expect(plan.get('25-1')?.audit_ids).toEqual(['a1', 'a2']);
        expect(plan.get('25-2')?.target_type_id).toBe('tillsyn-lptt');
    });
});
