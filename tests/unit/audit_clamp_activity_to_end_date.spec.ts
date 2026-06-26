import {
    clamp_audit_activity_to_end_date,
    count_timestamps_after_end_date,
    is_timestamp_after_end_date,
    total_clamp_count
} from '../../js/logic/audit_clamp_activity_to_end_date.js';
import { get_end_of_stockholm_calendar_day_iso } from '../../shared/datetime/filename_datetime.js';
import { AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY } from '../../js/logic/audit_list_last_updated.js';

describe('audit_clamp_activity_to_end_date', () => {
    const end_date = '2024-06-15T00:00:00.000Z';
    const after_end = '2024-06-20T12:00:00.000Z';
    const on_end_day = '2024-06-15T10:00:00.000Z';

    test('get_end_of_stockholm_calendar_day_iso ger sista tid på kalenderdag', () => {
        const boundary = get_end_of_stockholm_calendar_day_iso(end_date);
        expect(is_timestamp_after_end_date(on_end_day, end_date)).toBe(false);
        expect(is_timestamp_after_end_date(boundary, end_date)).toBe(false);
        expect(is_timestamp_after_end_date(after_end, end_date)).toBe(true);
    });

    test('count_timestamps_after_end_date räknar klick, krav och fryst tid', () => {
        const state = {
            auditStatus: 'locked',
            auditLastUpdatedAtFrozen: after_end,
            auditMetadata: {
                [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: after_end
            },
            samples: [{
                id: 's1',
                requirementResults: {
                    r1: {
                        lastStatusUpdate: after_end,
                        checkResults: {
                            c1: {
                                timestamp: after_end,
                                passCriteria: {
                                    pc1: { timestamp: after_end }
                                }
                            }
                        }
                    }
                }
            }]
        };
        const counts = count_timestamps_after_end_date(state, end_date);
        expect(counts.click_count).toBe(2);
        expect(counts.requirement_count).toBe(1);
        expect(counts.frozen_count).toBe(2);
        expect(total_clamp_count(counts)).toBe(5);
    });

    test('clamp_audit_activity_to_end_date justerar tidsstämplar till slutdagens gräns', () => {
        const state = {
            auditStatus: 'locked',
            auditLastUpdatedAtFrozen: after_end,
            auditMetadata: {
                [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: after_end
            },
            samples: [{
                id: 's1',
                requirementResults: {
                    r1: {
                        lastStatusUpdate: after_end,
                        checkResults: {
                            c1: {
                                timestamp: after_end,
                                passCriteria: {
                                    pc1: { timestamp: on_end_day }
                                }
                            }
                        }
                    }
                }
            }]
        };
        const boundary = get_end_of_stockholm_calendar_day_iso(end_date);
        const { state: clamped, adjusted_counts } = clamp_audit_activity_to_end_date(state, end_date);
        expect(adjusted_counts.click_count).toBe(1);
        expect(adjusted_counts.requirement_count).toBe(1);
        expect(adjusted_counts.frozen_count).toBe(2);
        const req = clamped.samples![0].requirementResults!.r1;
        expect(req.checkResults!.c1.timestamp).toBe(boundary);
        expect(req.checkResults!.c1.passCriteria!.pc1.timestamp).toBe(on_end_day);
        expect(req.lastStatusUpdate).toBe(boundary);
        expect(clamped.auditLastUpdatedAtFrozen).toBe(boundary);
    });

    test('ingen justering när alla tidsstämplar ligger på eller före slutdatum', () => {
        const state = {
            auditStatus: 'locked',
            samples: [{
                id: 's1',
                requirementResults: {
                    r1: {
                        lastStatusUpdate: on_end_day,
                        checkResults: {
                            c1: { timestamp: on_end_day, passCriteria: {} }
                        }
                    }
                }
            }]
        };
        const counts = count_timestamps_after_end_date(state, end_date);
        expect(total_clamp_count(counts)).toBe(0);
    });
});
