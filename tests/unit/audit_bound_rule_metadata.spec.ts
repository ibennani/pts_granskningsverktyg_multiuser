/**
 * @fileoverview Tester för audit_bound_rule_metadata.ts
 */

import { describe, it, expect } from '@jest/globals';
import {
    resolve_effective_rule_set_id_for_audit,
    with_bound_rule_metadata,
    AUDIT_METADATA_BOUND_RULE_SET_ID_KEY
} from '../../js/logic/audit_bound_rule_metadata.ts';

describe('audit_bound_rule_metadata', () => {
    it('prioriterar ruleSetId i state framför bound metadata', () => {
        const id = resolve_effective_rule_set_id_for_audit({
            ruleSetId: 'state-id',
            auditMetadata: { [AUDIT_METADATA_BOUND_RULE_SET_ID_KEY]: 'bound-id' }
        });
        expect(id).toBe('state-id');
    });

    it('läser boundRuleSetId från metadata när state saknar ruleSetId', () => {
        const id = resolve_effective_rule_set_id_for_audit({
            ruleSetId: null,
            auditMetadata: { [AUDIT_METADATA_BOUND_RULE_SET_ID_KEY]: 'bound-id' }
        });
        expect(id).toBe('bound-id');
    });

    it('with_bound_rule_metadata sätter bundna fält', () => {
        const meta = with_bound_rule_metadata({ caseNumber: '1' }, 'rule-1', '3.0.0');
        expect(meta.boundRuleSetId).toBe('rule-1');
        expect(meta.boundRuleVersion).toBe('3.0.0');
        expect(meta.caseNumber).toBe('1');
    });
});
