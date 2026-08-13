/**
 * @fileoverview Enhetstester för explicit detectionPattern-prioritet.
 */
import { describe, test, expect } from '@jest/globals';
import { apply_detection_patterns_to_content_types } from '../../shared/rulefile/content_type_detection_pattern_rulefile_apply.ts';

describe('content_type_detection_pattern_rulefile_apply', () => {
    test('behåller explicit detectionPattern och detectionSelector', () => {
        const groups = [
            {
                id: 'g1',
                types: [
                    {
                        id: 'form',
                        text: 'Formulär',
                        detectionPattern: 'EXPLICIT_PATTERN',
                        detectionSelector: '#my-form',
                    },
                ],
            },
        ];
        const result = apply_detection_patterns_to_content_types(groups, 'web');
        const child = (result[0] as { types: Array<Record<string, string>> }).types[0];
        expect(child.detectionPattern).toBe('EXPLICIT_PATTERN');
        expect(child.detectionSelector).toBe('#my-form');
    });
});
