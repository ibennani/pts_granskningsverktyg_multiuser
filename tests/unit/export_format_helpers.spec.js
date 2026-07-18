import { get_audit_ended_iso_for_export, get_audit_last_updated_iso_for_export, strip_markdown_for_excel } from '../../js/export/export_format_helpers.ts';

describe('get_audit_ended_iso_for_export', () => {
    test('använder sluttid från granskningen', () => {
        const end_ts = '2026-06-20T15:00:00.000Z';
        const audit = {
            endTime: end_ts,
            updated_at: '2020-01-01T00:00:00.000Z',
            samples: [],
        };
        expect(get_audit_ended_iso_for_export(audit)).toBe(end_ts);
    });

    test('faller tillbaka till updated_at för avslutad granskning utan sluttid', () => {
        const audit = {
            auditStatus: 'locked',
            updated_at: '2026-06-20T15:00:00.000Z',
            samples: [],
        };
        expect(get_audit_ended_iso_for_export(audit)).toBe('2026-06-20T15:00:00.000Z');
    });

    test('returnerar null utan audit', () => {
        expect(get_audit_ended_iso_for_export(null)).toBeNull();
    });
});

describe('get_audit_last_updated_iso_for_export', () => {
    test('använder aktivitetstidsstämpel i stället för updated_at', () => {
        const activity_ts = '2026-06-17T11:44:26.000Z';
        const audit = {
            updated_at: '2020-01-01T00:00:00.000Z',
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        r1: {
                            lastStatusUpdate: activity_ts,
                            checkResults: {}
                        }
                    }
                }
            ]
        };
        expect(get_audit_last_updated_iso_for_export(audit)).toBe(activity_ts);
    });

    test('faller tillbaka till updated_at när ingen aktivitet finns', () => {
        const audit = {
            updated_at: '2020-01-01T00:00:00.000Z',
            samples: []
        };
        expect(get_audit_last_updated_iso_for_export(audit)).toBe('2020-01-01T00:00:00.000Z');
    });

    test('returnerar null utan audit', () => {
        expect(get_audit_last_updated_iso_for_export(null)).toBeNull();
    });
});

describe('strip_markdown_for_excel', () => {
    test('tar bort backticks men behåller inline-kodens innehåll', () => {
        const input = 'Taggar: `<b>`, `<i>`, `<br>` och mer.';
        const result = strip_markdown_for_excel(input);

        expect(result).toContain('<b>');
        expect(result).toContain('<i>');
        expect(result).toContain('<br>');
        expect(result).not.toContain('`');
        expect(result).not.toMatch(/INLINECODE/i);
    });

    test('tar bort kursiv-markdown men behåller ordet', () => {
        const input =
            'flyttar pekaren,*väljer*att dölja det, eller tills den visade informationen inte längre är relevant.';
        const result = strip_markdown_for_excel(input);

        expect(result).toContain('väljer');
        expect(result).toContain('att dölja');
        expect(result).not.toMatch(/ITALIC/i);
        expect(result).not.toContain('*');
    });
});
