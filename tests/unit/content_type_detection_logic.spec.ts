/**
 * @fileoverview Enhetstester för klientlogik vid innehållstyp-detektering.
 */
import { describe, test, expect } from '@jest/globals';
import {
    collect_allowed_content_type_ids,
    count_newly_applied_ids,
    should_apply_detected_content_types,
} from '../../js/components/add_sample_form/content_type_detection_logic.ts';

describe('content_type_detection_logic', () => {
    test('collect_allowed_content_type_ids plattar ut undertyper', () => {
        const ids = collect_allowed_content_type_ids({
            metadata: {
                contentTypes: [
                    { types: [{ id: 'forms' }, { id: 'tables' }] },
                    { types: [{ id: 'video' }] },
                ],
            },
        });
        expect(ids).toEqual(['forms', 'tables', 'video']);
    });

    test('collect_allowed_content_type_ids använder föräldra-id utan undertyper', () => {
        const ids = collect_allowed_content_type_ids({
            metadata: {
                contentTypes: [
                    { id: 'forms', text: 'Formulär', types: [] },
                    { types: [{ id: 'video' }] },
                ],
            },
        });
        expect(ids).toEqual(['forms', 'video']);
    });

    test('should_apply_detected_content_types endast vid tomt val', () => {
        expect(should_apply_detected_content_types([])).toBe(true);
        expect(should_apply_detected_content_types(['forms'])).toBe(false);
    });

    test('count_newly_applied_ids räknar nya ID:n', () => {
        expect(count_newly_applied_ids(['forms'], ['forms', 'tables'])).toBe(1);
        expect(count_newly_applied_ids(['forms'], ['forms'])).toBe(0);
    });
});
