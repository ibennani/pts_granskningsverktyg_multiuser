/**
 * @fileoverview Tester för senast aktivitet under pågående granskning (listvisning).
 */

import { describe, expect, test } from '@jest/globals';
import {
    AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY,
    get_last_activity_from_samples,
    max_iso_timestamps,
    resolve_audit_list_last_updated_at,
    with_last_in_progress_activity_in_metadata,
    without_last_in_progress_activity_in_metadata
} from '../../js/logic/audit_list_last_updated.ts';
import { get_audit_last_updated_display_timestamp } from '../../js/logic/audit_logic_recalc.ts';

const SAMPLE_TS = '2026-05-29T05:45:59.000Z';
const FROZEN_TS = '2026-05-28T10:00:00.000Z';
const DB_UPDATED = '2026-06-01T12:00:00.000Z';

const samples_with_activity = [
    {
        id: 's1',
        requirementResults: {
            r1: {
                lastStatusUpdate: SAMPLE_TS,
                checkResults: {}
            }
        }
    }
];

describe('audit_list_last_updated', () => {
    test('max_iso_timestamps väljer senaste', () => {
        expect(max_iso_timestamps('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')).toBe(
            '2026-02-01T00:00:00.000Z'
        );
        expect(max_iso_timestamps(null, undefined, '2026-03-01T00:00:00.000Z')).toBe('2026-03-01T00:00:00.000Z');
    });

    test('get_last_activity_from_samples läser lastStatusUpdate', () => {
        expect(get_last_activity_from_samples(samples_with_activity)).toBe(SAMPLE_TS);
    });

    test('låst granskning använder fryst metadata före databas updated_at', () => {
        const display = resolve_audit_list_last_updated_at({
            status: 'locked',
            metadata: { [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: FROZEN_TS },
            samples: samples_with_activity,
            updated_at: DB_UPDATED
        });
        expect(display).toBe(FROZEN_TS);
    });

    test('arkiverad utan metadata faller tillbaka till stickprov', () => {
        const display = resolve_audit_list_last_updated_at({
            status: 'archived',
            metadata: {},
            samples: samples_with_activity,
            updated_at: DB_UPDATED
        });
        expect(display).toBe(SAMPLE_TS);
    });

    test('pågående väljer senaste av metadata och stickprov', () => {
        const display = resolve_audit_list_last_updated_at({
            status: 'in_progress',
            metadata: { [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: '2026-05-30T08:00:00.000Z' },
            samples: samples_with_activity,
            updated_at: DB_UPDATED
        });
        expect(display).toBe('2026-05-30T08:00:00.000Z');
    });

    test('with och without metadata-hjälpare', () => {
        const bumped = with_last_in_progress_activity_in_metadata({}, SAMPLE_TS);
        expect(bumped[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]).toBe(SAMPLE_TS);
        const cleared = without_last_in_progress_activity_in_metadata(bumped);
        expect(cleared).not.toHaveProperty(AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY);
    });

    test('get_audit_last_updated_display_timestamp använder fryst metadata för låst', () => {
        const state = {
            auditStatus: 'locked',
            auditMetadata: { [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: FROZEN_TS },
            samples: samples_with_activity,
            auditLastUpdatedAtFrozen: FROZEN_TS
        };
        expect(get_audit_last_updated_display_timestamp(state)).toBe(FROZEN_TS);
    });
});
