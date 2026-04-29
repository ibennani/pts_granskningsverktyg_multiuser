/**
 * @fileoverview Tester för export_deficiency_traversal.
 */

import { describe, test, expect } from '@jest/globals';
import {
    for_each_failed_export_pass_criterion,
    for_each_failed_in_requirement_result
} from '../../js/export/export_deficiency_traversal.js';

describe('export_deficiency_traversal', () => {
    test('for_each_failed_in_requirement_result anropar bara vid underkänt med brist-id', () => {
        const result = {
            checkResults: {
                c1: {
                    passCriteria: {
                        p1: { status: 'failed', deficiencyId: 'B1' },
                        p2: { status: 'passed', deficiencyId: 'B2' },
                        p3: { status: 'failed' }
                    }
                }
            }
        };
        const seen = [];
        for_each_failed_in_requirement_result(result, (ctx) => {
            seen.push(ctx.pc_id);
        });
        expect(seen).toEqual(['p1']);
    });

    test('for_each_failed_export_pass_criterion kopplar regelfil till lagrat kriterium', () => {
        const req_def = {
            id: 'r1',
            key: 'r1',
            title: 'Titel',
            checks: [{ id: 'c1', passCriteria: [{ id: 'p1', requirement: 'text', failureStatementTemplate: '' }] }]
        };
        const audit = {
            ruleFileContent: {
                requirements: { r1: req_def }
            },
            samples: [
                {
                    id: 's1',
                    requirementResults: {
                        r1: {
                            checkResults: {
                                c1: {
                                    passCriteria: {
                                        p1: { status: 'failed', deficiencyId: 'B01', observationDetail: '' }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        };
        const hits = [];
        for_each_failed_export_pass_criterion(audit, (ctx) => {
            hits.push(ctx.req_definition.title);
        });
        expect(hits).toEqual(['Titel']);
    });
});
