/**
 * @jest-environment node
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(spec_dir, '../../js/api/client.js');
const sync_logic_path = path.join(spec_dir, '../../js/logic/rulefile_deficiency_types_server_sync.ts');

const get_rule_mock = jest.fn();
const get_rules_mock = jest.fn();

jest.unstable_mockModule(client_path, () => ({
    get_rule: get_rule_mock,
    get_rules: get_rules_mock,
}));

const { merge_deficiency_types_from_server_if_missing } = await import(sync_logic_path);

describe('merge_deficiency_types_from_server_if_missing', () => {
    beforeEach(() => {
        get_rule_mock.mockReset();
        get_rules_mock.mockReset();
        get_rules_mock.mockResolvedValue([{ id: 'rule-1' }]);
    });

    test('returnerar oförändrat utan rule_set_id', async () => {
        const local = {
            requirements: {
                req1: { title: 'Krav 1' },
            },
        };

        const result = await merge_deficiency_types_from_server_if_missing(null, local);

        expect(result.changed).toBe(false);
        expect(result.content).toBe(local);
        expect(get_rule_mock).not.toHaveBeenCalled();
        expect(get_rules_mock).not.toHaveBeenCalled();
    });

    test('anropar inte get_rule när rule_set_id saknas i regelfilslistan', async () => {
        get_rules_mock.mockResolvedValue([{ id: 'annan-regel' }]);

        const local = {
            requirements: {
                req1: { title: 'Krav 1' },
            },
        };

        const result = await merge_deficiency_types_from_server_if_missing('rule-1', local);

        expect(result.changed).toBe(false);
        expect(result.content).toBe(local);
        expect(get_rule_mock).not.toHaveBeenCalled();
    });

    test('fyller i DeficiencyType från servern när lokalt utkast saknar PrimaryText', async () => {
        get_rule_mock.mockResolvedValue({
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

    test('skriver inte över lokala bristtyper som redan har PrimaryText', async () => {
        get_rule_mock.mockResolvedValue({
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
