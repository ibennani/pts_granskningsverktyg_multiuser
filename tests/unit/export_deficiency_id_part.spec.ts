/**
 * @fileoverview Enhetstester för id-delens bredd i exportfilnamn.
 */

import {
    format_zero_id_part_for_sample,
    resolve_deficiency_id_part_width
} from '../../js/export/export_deficiency_traversal.ts';

describe('export_deficiency_id_part', () => {
    test('resolve_deficiency_id_part_width minst 3 utan brister', () => {
        expect(resolve_deficiency_id_part_width({ samples: [] })).toBe(3);
    });

    test('resolve_deficiency_id_part_width från längsta bristnummer', () => {
        const audit = {
            ruleFileContent: { requirements: { r1: { key: 'r1' } } },
            samples: [
                {
                    requirementResults: {
                        r1: {
                            checkResults: {
                                c1: {
                                    passCriteria: {
                                        pc1: { status: 'failed', deficiencyId: 'B1047' }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };
        expect(resolve_deficiency_id_part_width(audit)).toBe(4);
    });

    test('format_zero_id_part_for_sample', () => {
        expect(format_zero_id_part_for_sample(3)).toBe('000');
        expect(format_zero_id_part_for_sample(4)).toBe('0000');
        expect(format_zero_id_part_for_sample(2)).toBe('000');
    });
});
