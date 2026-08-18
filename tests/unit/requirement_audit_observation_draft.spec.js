/**
 * @fileoverview Verifierar att observationsutkast är isolerade per granskningsdel.
 */
import { RequirementAuditComponent } from '../../js/components/RequirementAuditComponent.ts';

describe('RequirementAuditComponent observationsutkast per sample', () => {
    test('utkast från en granskningsdel appliceras inte på en annan', () => {
        const comp = new RequirementAuditComponent();
        comp.params = { sampleId: 'sample-a' };
        comp._pc_observation_drafts.set(comp._pc_observation_draft_key('1', '1.3', 'sample-a'), 'Text A');

        comp.params = { sampleId: 'sample-b' };
        const result = {
            checkResults: {
                '1': {
                    passCriteria: {
                        '1.3': { status: 'failed', observationDetail: '' },
                    },
                },
            },
        };

        comp._apply_pc_observation_drafts_to_result(result);
        expect(result.checkResults['1'].passCriteria['1.3'].observationDetail).toBe('');
        expect(comp._get_pc_observation_draft('1', '1.3')).toBeUndefined();
    });

    test('utkast för aktuell granskningsdel appliceras', () => {
        const comp = new RequirementAuditComponent();
        comp.params = { sampleId: 'sample-a' };
        comp._pc_observation_drafts.set(comp._pc_observation_draft_key('1', '1.3', 'sample-a'), 'Text A');

        const result = {
            checkResults: {
                '1': {
                    passCriteria: {
                        '1.3': { status: 'failed', observationDetail: '' },
                    },
                },
            },
        };

        comp._apply_pc_observation_drafts_to_result(result);
        expect(result.checkResults['1'].passCriteria['1.3'].observationDetail).toBe('Text A');
    });
});
