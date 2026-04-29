/**
 * @fileoverview Enhetstester för traverse_audit_data.
 */

import { describe, test, expect } from '@jest/globals';
import {
    traverse_all_pass_criteria,
    traverse_all_check_results,
    traverse_all_requirement_results
} from '../../js/utils/traverse_audit_data.js';

describe('traverse_audit_data', () => {
    const audit = {
        samples: [
            {
                id: 's1',
                requirementResults: {
                    r1: {
                        checkResults: {
                            c1: {
                                passCriteria: {
                                    p1: { status: 'failed' },
                                    p2: { status: 'passed' }
                                }
                            }
                        }
                    }
                }
            }
        ]
    };

    test('traverse_all_pass_criteria besöker alla kriterier', () => {
        const keys: string[] = [];
        traverse_all_pass_criteria(audit, ({ pc_key }) => {
            keys.push(pc_key);
        });
        expect(keys.sort()).toEqual(['p1', 'p2']);
    });

    test('traverse_all_check_results besöker kontroller', () => {
        const keys: string[] = [];
        traverse_all_check_results(audit, ({ check_key }) => {
            keys.push(check_key);
        });
        expect(keys).toEqual(['c1']);
    });

    test('traverse_all_requirement_results besöker krav', () => {
        const keys: string[] = [];
        traverse_all_requirement_results(audit, ({ req_key }) => {
            keys.push(req_key);
        });
        expect(keys).toEqual(['r1']);
    });

    test('hanterar tom state', () => {
        let n = 0;
        traverse_all_pass_criteria(null, () => {
            n += 1;
        });
        traverse_all_pass_criteria({}, () => {
            n += 1;
        });
        expect(n).toBe(0);
    });
});
