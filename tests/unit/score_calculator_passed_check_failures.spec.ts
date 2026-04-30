/**
 * @fileoverview Tester för count_failed_pass_criteria_under_passed_checks.
 */

import { describe, test, expect } from '@jest/globals';
import { count_failed_pass_criteria_under_passed_checks } from '../../js/logic/score_calculator_passed_check_failures.js';

describe('count_failed_pass_criteria_under_passed_checks', () => {
    test('räknar endast underkänt kriterium under godkänd kontroll', () => {
        const req = {
            checkResults: {
                c1: {
                    overallStatus: 'passed',
                    passCriteria: {
                        p1: { status: 'failed' },
                        p2: { status: 'passed' }
                    }
                },
                c2: {
                    overallStatus: 'failed',
                    passCriteria: {
                        p3: { status: 'failed' }
                    }
                }
            }
        };
        expect(count_failed_pass_criteria_under_passed_checks(req)).toBe(1);
    });

    test('returnerar 0 utan checkResults', () => {
        expect(count_failed_pass_criteria_under_passed_checks(undefined)).toBe(0);
        expect(count_failed_pass_criteria_under_passed_checks({})).toBe(0);
    });
});
