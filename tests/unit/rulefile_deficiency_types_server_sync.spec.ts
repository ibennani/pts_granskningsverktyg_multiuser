/**
 * @jest-environment node
 */
import { merge_deficiency_types_from_server_if_missing } from '../../js/logic/rulefile_deficiency_types_server_sync.ts';

jest.mock('../../js/api/client.js', () => ({
    get_rule: jest.fn(),
}));

import { get_rule } from '../../js/api/client.js';

const mocked_get_rule = get_rule as jest.MockedFunction<typeof get_rule>;

describe('merge_deficiency_types_from_server_if_missing', () => {
    beforeEach(() => {
        mocked_get_rule.mockReset();
    });

    it('returnerar oförändrat utan rule_set_id', async () => {
        const local = {
            requirements: {
                req1: { title: 'Krav 1' },
            },
        };

        const result = await merge_deficiency_types_from_server_if_missing(null, local);

        expect(result.changed).toBe(false);
        expect(result.content).toBe(local);
        expect(mocked_get_rule).not.toHaveBeenCalled();
    });

    it('fyller i DeficiencyType från servern när lokalt utkast saknar PrimaryText', async () => {
        mocked_get_rule.mockResolvedValue({
            content: {
                requirements: {
                    req1: {
                        title: 'Krav 1',
                        DeficiencyType: {
                            PrimaryText: 'Huvudmening',
                            SecondaryText: 'Förklaring',
                        },
                    },
                },
            },
        });

        const local = {
            requirements: {
                req1: { title: 'Krav 1' },
            },
        };

        const result = await merge_deficiency_types_from_server_if_missing('rule-1', local);

        expect(result.changed).toBe(true);
        expect(result.content.requirements.req1.DeficiencyType).toEqual({
            PrimaryText: 'Huvudmening',
            SecondaryText: 'Förklaring',
        });
    });

    it('skriver inte över lokala bristtyper som redan har PrimaryText', async () => {
        mocked_get_rule.mockResolvedValue({
            content: {
                requirements: {
                    req1: {
                        DeficiencyType: {
                            PrimaryText: 'Från server',
                            SecondaryText: 'Server',
                        },
                    },
                },
            },
        });

        const local = {
            requirements: {
                req1: {
                    DeficiencyType: {
                        PrimaryText: 'Lokalt utkast',
                        SecondaryText: 'Lokal',
                    },
                },
            },
        };

        const result = await merge_deficiency_types_from_server_if_missing('rule-1', local);

        expect(result.changed).toBe(false);
        expect(result.content).toBe(local);
    });
});
