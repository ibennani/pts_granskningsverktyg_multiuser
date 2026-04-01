/**
 * Tester för rulefile_migration_logic.js — migrering av gammal regelfilsstruktur till infoBlocks.
 */
import { describe, test, expect, jest } from '@jest/globals';
import { migrate_rulefile_to_new_structure } from '../../js/logic/rulefile_migration_logic.js';

describe('rulefile_migration_logic', () => {
    test('returnerar ogiltigt innehåll oförändrat (null, undefined, primitiv)', () => {
        expect(migrate_rulefile_to_new_structure(null)).toBeNull();
        expect(migrate_rulefile_to_new_structure(undefined)).toBeUndefined();
        expect(migrate_rulefile_to_new_structure('x')).toBe('x');
    });

    test('tomt objekt får metadata.blockOrders.infoBlocks med standardordning', () => {
        const out = migrate_rulefile_to_new_structure({});
        expect(out.metadata.blockOrders.infoBlocks).toEqual([
            'expectedObservation',
            'instructions',
            'exceptions',
            'commonErrors',
            'tips',
            'examples'
        ]);
    });

    test('bevarar befintlig infoBlocks-array om den redan finns', () => {
        const custom = ['instructions', 'tips'];
        const input = {
            metadata: { blockOrders: { infoBlocks: custom } },
            requirements: {}
        };
        const out = migrate_rulefile_to_new_structure(input);
        expect(out.metadata.blockOrders.infoBlocks).toEqual(custom);
    });

    test('fyller tom eller saknad infoBlocks-array med standard när krav saknas', () => {
        const input = {
            metadata: { blockOrders: { infoBlocks: [] } },
            requirements: {}
        };
        const out = migrate_rulefile_to_new_structure(input);
        expect(out.metadata.blockOrders.infoBlocks.length).toBeGreaterThan(0);
    });

    test('konverterar gamla fält på krav till infoBlocks och tar bort gamla nycklar', () => {
        const input = {
            metadata: {},
            requirements: {
                r1: {
                    id: 'r1',
                    expectedObservation: 'Obs',
                    instructions: 'Inst'
                }
            }
        };
        const out = migrate_rulefile_to_new_structure(input);
        const req = out.requirements.r1;
        expect(req.infoBlocks).toBeDefined();
        expect(req.infoBlocks.expectedObservation.text).toBe('Obs');
        expect(req.infoBlocks.instructions.text).toBe('Inst');
        expect(req.expectedObservation).toBeUndefined();
        expect(req.instructions).toBeUndefined();
    });

    test('hoppar över krav som redan har infoBlocks', () => {
        const existing = {
            expectedObservation: { name: 'X', expanded: false, text: 'behålls' }
        };
        const input = {
            metadata: {},
            requirements: {
                r1: {
                    expectedObservation: 'ska ignoreras',
                    infoBlocks: existing
                }
            }
        };
        const out = migrate_rulefile_to_new_structure(input);
        expect(out.requirements.r1.infoBlocks).toEqual(existing);
    });

    test('arrayfält sammanfogas med radbrytningar', () => {
        const input = {
            metadata: {},
            requirements: {
                r1: { tips: ['a', 'b'] }
            }
        };
        const out = migrate_rulefile_to_new_structure(input);
        expect(out.requirements.r1.infoBlocks.tips.text).toBe('a\n\nb');
    });

    test('använder Translation.t för blocknamn när options.Translation finns', () => {
        const t = jest.fn((k) => `T:${k}`);
        const input = {
            metadata: {},
            requirements: { r1: { instructions: 'x' } }
        };
        const out = migrate_rulefile_to_new_structure(input, { Translation: { t } });
        expect(t).toHaveBeenCalled();
        expect(out.requirements.r1.infoBlocks.instructions.name).toBe('T:requirement_instructions');
    });

    test('muterar inte originalobjektet (djup kopia)', () => {
        const input = {
            metadata: {},
            requirements: { r1: { instructions: 'x' } }
        };
        const snapshot = JSON.stringify(input);
        migrate_rulefile_to_new_structure(input);
        expect(JSON.stringify(input)).toBe(snapshot);
    });
});
