import { describe, it, expect } from '@jest/globals';
import { parse_audit_part_key } from '../../js/logic/audit_part_keys.js';
import {
    merge_audit_result_from_broadcast,
    merge_rulefile_infoblock
} from '../../js/logic/same_user_tab_field_sync.js';

describe('same_user_tab_field_sync', () => {
    it('merge_audit_result_from_broadcast uppdaterar kommentar', () => {
        const state = {
            samples: [{
                id: 's1',
                requirementResults: {
                    r1: { commentToAuditor: 'gammal', status: 'not_audited' }
                }
            }]
        };
        const pk = 'audit:a1:sample:s1:req:r1:commentToAuditor';
        const parsed = parse_audit_part_key(pk);
        const out = merge_audit_result_from_broadcast(state, parsed, 'ny');
        expect(out.sampleId).toBe('s1');
        expect(out.requirementId).toBe('r1');
        expect(out.newRequirementResult.commentToAuditor).toBe('ny');
        expect(out.newRequirementResult.status).toBe('not_audited');
    });

    it('merge_rulefile_infoblock uppdaterar infoblock-text', () => {
        const state = {
            ruleFileContent: {
                requirements: {
                    reqKey: {
                        infoBlocks: { b1: { name: 'N', expanded: true, text: 'gammal' } }
                    }
                }
            }
        };
        const out = merge_rulefile_infoblock(state, 'reqKey', 'b1', 'ny text');
        expect(out.requirementId).toBe('reqKey');
        expect(out.updatedRequirementData.infoBlocks.b1.text).toBe('ny text');
        expect(out.updatedRequirementData.infoBlocks.b1.name).toBe('N');
    });
});
