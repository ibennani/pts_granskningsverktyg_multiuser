/**
 * @fileoverview Tester för innehållstyp-hjälpare med krav som array eller objekt.
 */

import { describe, it, expect } from '@jest/globals';
import {
    get_requirements_by_content_type_id,
    remove_content_type_from_requirements
} from '../../js/utils/content_types_helper.js';

describe('content_types_helper', () => {
    it('get_requirements_by_content_type_id hittar krav i arrayformat med rätt id', () => {
        const rule = {
            requirements: [
                { id: 'r1', title: 'A', contentType: ['ct-x'] },
                { id: 'r2', title: 'B', contentType: ['ct-y'] }
            ]
        };
        const hits = get_requirements_by_content_type_id(rule, 'ct-x');
        expect(hits).toHaveLength(1);
        expect(hits[0].id).toBe('r1');
        expect(hits[0].requirement.title).toBe('A');
    });

    it('remove_content_type_from_requirements bevarar arrayformat', () => {
        const rule = {
            metadata: {},
            requirements: [
                { id: 'r1', title: 'A', contentType: ['a', 'b'] },
                { id: 'r2', title: 'B', contentType: ['a'] }
            ]
        };
        const out = remove_content_type_from_requirements(rule, 'b');
        expect(Array.isArray(out.requirements)).toBe(true);
        expect(out.requirements[0].contentType).toEqual(['a']);
        expect(out.requirements[1].contentType).toEqual(['a']);
    });
});
