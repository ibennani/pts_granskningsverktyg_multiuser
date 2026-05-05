/**
 * Tester: UPDATE_REQUIREMENT_DEFINITION ska hitta rätt lagringsnyckel när payload använder id men kravet ligger under key.
 */
import { describe, test, expect } from '@jest/globals';
import { auditReducer } from '../../js/state/auditReducer.js';
import { ActionTypes } from '../../js/state/actionTypes.js';

describe('auditReducer UPDATE_REQUIREMENT_DEFINITION', () => {
    test('uppdaterar krav när requirementId är intern id men posten ligger under key i requirements-map', () => {
        const state = {
            ruleFileContent: {
                requirements: {
                    'min-nyckel': {
                        id: 'uuid-intern-1',
                        key: 'min-nyckel',
                        title: 'Krav',
                        infoBlocks: { tips: { name: 'T', expanded: true, text: 'gammal' } }
                    }
                }
            }
        };
        const next = auditReducer(state, {
            type: ActionTypes.UPDATE_REQUIREMENT_DEFINITION,
            payload: {
                requirementId: 'uuid-intern-1',
                updatedRequirementData: {
                    id: 'uuid-intern-1',
                    key: 'min-nyckel',
                    title: 'Krav',
                    infoBlocks: { tips: { name: 'T', expanded: true, text: '' } }
                }
            }
        });
        expect(next.ruleFileContent.requirements['min-nyckel'].infoBlocks.tips.text).toBe('');
    });
});
