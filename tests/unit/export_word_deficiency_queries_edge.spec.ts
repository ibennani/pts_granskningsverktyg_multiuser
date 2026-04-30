/**
 * @fileoverview Kantfall för Word-export-hjälpare: saknad regelfil i state.
 */

import { describe, it, expect } from '@jest/globals';
import {
    get_total_requirements_count,
    get_all_deficiencies_for_sample_generic
} from '../../js/export/export_word_deficiency_queries.js';

describe('export_word_deficiency_queries kantfall', () => {
    it('get_total_requirements_count utan ruleFileContent kastar inte', () => {
        expect(get_total_requirements_count({ samples: [] })).toBe(0);
        expect(get_total_requirements_count({ ruleFileContent: null, samples: [] })).toBe(0);
    });

    it('get_all_deficiencies_for_sample_generic utan ruleFileContent returnerar tom lista', () => {
        const sample = { id: 's1', requirementResults: {} };
        const audit = { samples: [sample] };
        expect(get_all_deficiencies_for_sample_generic(sample, audit)).toEqual([]);
        expect(get_all_deficiencies_for_sample_generic(sample, { ruleFileContent: null })).toEqual([]);
    });
});
