/**
 * @fileoverview Enhetstester för pending_detected_content_types.
 */
import { describe, test, expect } from '@jest/globals';
import {
    compute_new_detected_content_type_ids,
    should_queue_pending_detected_content_types,
    apply_accepted_pending_content_types,
} from '../../js/logic/pending_detected_content_types.ts';

describe('pending_detected_content_types', () => {
    test('add-only: nya typer som inte redan är valda', () => {
        expect(compute_new_detected_content_type_ids(['a'], ['a', 'b'])).toEqual(['b']);
    });

    test('köas bara under pågående granskning med granskade krav', () => {
        const sample = {
            selectedContentTypes: ['a'],
            requirementResults: { r1: { status: 'passed' } },
        };
        expect(should_queue_pending_detected_content_types('in_progress', sample, ['b'])).toBe(true);
        expect(should_queue_pending_detected_content_types('not_started', sample, ['b'])).toBe(false);
    });

    test('accepterade pending-typer läggs till i selected', () => {
        const result = apply_accepted_pending_content_types(['a'], ['b', 'c'], ['b']);
        expect(result.selectedContentTypes.sort()).toEqual(['a', 'b']);
        expect(result.pendingDetectedContentTypes).toEqual(['c']);
    });
});
