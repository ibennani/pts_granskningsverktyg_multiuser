/**
 * @fileoverview Tester för canonical_published_rule_resolve.ts
 */

import { describe, it, expect } from '@jest/globals';
import { resolve_canonical_published_rule_row } from '../../js/logic/canonical_published_rule_resolve.ts';

describe('canonical_published_rule_resolve', () => {
    const v_gt = (a: string, b: string) => a > b;

    it('väljer rad via ruleSetId när den finns', () => {
        const rules = [
            { id: 'a', metadata_version: '1.0.0', is_published: true },
            { id: 'target', metadata_version: '2.0.0', is_published: true }
        ];
        const row = resolve_canonical_published_rule_row(rules, v_gt, { ruleSetId: 'target' });
        expect(row?.id).toBe('target');
    });

    it('matchar via monitoringType.text bland publicerade regler', () => {
        const rules = [
            {
                id: 'r1',
                monitoring_type_text: 'Tillsyn A',
                metadata_version: '2.0.0',
                is_published: true
            }
        ];
        const row = resolve_canonical_published_rule_row(rules, v_gt, {
            ruleFileContent: {
                metadata: { monitoringType: { text: 'Tillsyn A' } }
            }
        });
        expect(row?.id).toBe('r1');
    });

    it('returnerar null utan matchande publicerad regel', () => {
        const rules = [{ id: 'r', name: 'annan', metadata_version: '9.0.0', is_published: true }];
        const row = resolve_canonical_published_rule_row(rules, v_gt, {
            ruleFileContent: { metadata: { version: '1.0.0', title: 'Unik' } }
        });
        expect(row).toBeNull();
    });
});
