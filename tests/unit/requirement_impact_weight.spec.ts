/**
 * Enhetstester för requirement_impact_weight.
 */
import { describe, test, expect } from '@jest/globals';
import {
    apply_requirement_impact_change,
    calculate_requirement_weight,
    format_requirement_weight,
    read_requirement_impact,
} from '../../js/logic/requirement_impact_weight.ts';

describe('requirement_impact_weight', () => {
    test('read_requirement_impact returnerar standardvärden när impact saknas', () => {
        expect(read_requirement_impact({})).toEqual({
            isCritical: false,
            primaryScore: 0,
            secondaryScore: 0,
        });
    });

    test('calculate_requirement_weight följer bristindex-modellen', () => {
        const critical = calculate_requirement_weight({
            metadata: { impact: { isCritical: true, primaryScore: 10, secondaryScore: 5 } },
        });
        expect(critical).toBeCloseTo(Math.sqrt(12.5), 5);

        const non_critical = calculate_requirement_weight({
            metadata: { impact: { isCritical: false, primaryScore: 10, secondaryScore: 5 } },
        });
        expect(non_critical).toBeCloseTo(0.9 * Math.sqrt(12.5), 5);
    });

    test('format_requirement_weight visar två decimaler', () => {
        expect(format_requirement_weight(3.536)).toBe('3.54');
        expect(format_requirement_weight(0)).toBe('0');
    });

    test('apply_requirement_impact_change uppdaterar krav i regelfil', () => {
        const rule_file = {
            requirements: {
                req_a: { id: 'req_a', metadata: { impact: { isCritical: false, primaryScore: 1, secondaryScore: 0 } } },
            },
        };
        const next = apply_requirement_impact_change(rule_file, 'req_a', {
            isCritical: true,
            primaryScore: 4,
            secondaryScore: 2,
        });
        const impact = (next.requirements as Record<string, unknown>).req_a as Record<string, unknown>;
        const metadata = impact.metadata as Record<string, unknown>;
        expect(metadata.impact).toEqual({
            isCritical: true,
            primaryScore: 4,
            secondaryScore: 2,
        });
    });
});
