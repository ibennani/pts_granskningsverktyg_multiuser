import { get_audit_last_updated_iso_for_export } from '../../js/export/export_format_helpers.ts';

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
