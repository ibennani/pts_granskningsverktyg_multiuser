/**
 * @fileoverview Enhetstester för granskningsnummer vid export.
 */

import {
    resolve_audit_export_type_abbrev,
    resolve_audit_type_for_export,
    resolve_granskning_sequence_number,
    sanitize_export_type_abbrev
} from '../../js/logic/audit_granskning_sequence.ts';

describe('audit_granskning_sequence', () => {
    test('resolve_audit_type_for_export webb och pdf', () => {
        expect(
            resolve_audit_type_for_export({
                metadata: { monitoringType: { type: 'webb', text: 'Webb' } }
            })
        ).toBe('webb');
        expect(
            resolve_audit_type_for_export({
                metadata: { monitoringType: { text: 'PDF-dokument' } }
            })
        ).toBe('pdf');
    });

    test('resolve_audit_export_type_abbrev per regelfilsspråk', () => {
        const sv_rule = { metadata: { language: 'sv-SE', monitoringType: { type: 'webb' } } };
        const en_rule = { metadata: { language: 'en-GB', monitoringType: { type: 'webb' } } };
        const nb_rule = { metadata: { language: 'nb-NO', monitoringType: { type: 'webb' } } };

        expect(resolve_audit_export_type_abbrev('webb', sv_rule)).toBe('WEBB');
        expect(resolve_audit_export_type_abbrev('webb', en_rule)).toBe('WEB');
        expect(resolve_audit_export_type_abbrev('webb', nb_rule)).toBe('WEB');
        expect(resolve_audit_export_type_abbrev('pdf', en_rule)).toBe('PDF');
        expect(resolve_audit_export_type_abbrev(null, sv_rule)).toBeNull();
    });

    test('resolve_audit_export_type_abbrev fallback sv-SE när språk saknas', () => {
        expect(
            resolve_audit_export_type_abbrev('webb', {
                metadata: { monitoringType: { type: 'webb' } }
            })
        ).toBe('WEBB');
    });

    test('sanitize_export_type_abbrev', () => {
        expect(sanitize_export_type_abbrev('webb')).toBe('WEBB');
        expect(sanitize_export_type_abbrev('  pdf-1  ')).toBe('PDF1');
        expect(sanitize_export_type_abbrev('')).toBe('');
    });

    test('WEBB numreras separat från PDF med samma ärendenummer', () => {
        const audits = [
            { id: 'a1', metadata: { caseNumber: '26-11111' }, audit_type: 'webb', created_at: '2026-01-01T10:00:00Z' },
            { id: 'a2', metadata: { caseNumber: '26-11111' }, audit_type: 'pdf', created_at: '2026-01-02T10:00:00Z' },
            { id: 'a3', metadata: { caseNumber: '26-11111' }, audit_type: 'webb', created_at: '2026-01-03T10:00:00Z' }
        ];

        expect(
            resolve_granskning_sequence_number(audits, {
                audit_id: 'a1',
                case_number: '26-11111',
                audit_type: 'webb'
            })
        ).toBe(1);
        expect(
            resolve_granskning_sequence_number(audits, {
                audit_id: 'a3',
                case_number: '26-11111',
                audit_type: 'webb'
            })
        ).toBe(2);
        expect(
            resolve_granskning_sequence_number(audits, {
                audit_id: 'a2',
                case_number: '26-11111',
                audit_type: 'pdf'
            })
        ).toBe(1);
    });

    test('fallback 1 vid saknat ärendenummer eller okänd granskning', () => {
        expect(
            resolve_granskning_sequence_number([], {
                audit_id: 'x',
                case_number: '',
                audit_type: 'webb'
            })
        ).toBe(1);
        expect(
            resolve_granskning_sequence_number(
                [{ id: 'other', metadata: { caseNumber: '1' }, audit_type: 'webb', created_at: '2026-01-01' }],
                { audit_id: 'missing', case_number: '1', audit_type: 'webb' }
            )
        ).toBe(1);
    });
});
