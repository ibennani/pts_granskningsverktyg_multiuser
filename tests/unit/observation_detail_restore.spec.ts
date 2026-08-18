import {
    build_observation_restore_patches,
    build_full_observation_restore_patches,
    find_duplicate_observation_groups,
    apply_observation_restore_patches,
} from '../../js/logic/observation_detail_restore.ts';

describe('observation_detail_restore', () => {
    const current_samples = [
        {
            id: 's1',
            description: 'Cookie-banner',
            requirementResults: {
                krav_rubriker: {
                    checkResults: {
                        '1': {
                            passCriteria: {
                                '1.3': { observationDetail: 'Samma cookie-text' },
                            },
                        },
                    },
                },
            },
        },
        {
            id: 's2',
            description: 'Startsida',
            requirementResults: {
                krav_rubriker: {
                    checkResults: {
                        '1': {
                            passCriteria: {
                                '1.3': { observationDetail: 'Samma cookie-text' },
                            },
                        },
                    },
                },
            },
        },
    ];

    const backup_samples = [
        {
            id: 's1',
            description: 'Cookie-banner',
            requirementResults: {
                krav_rubriker: {
                    checkResults: {
                        '1': {
                            passCriteria: {
                                '1.3': { observationDetail: 'Text om cookiebannern' },
                            },
                        },
                    },
                },
            },
        },
        {
            id: 's2',
            description: 'Startsida',
            requirementResults: {
                krav_rubriker: {
                    checkResults: {
                        '1': {
                            passCriteria: {
                                '1.3': { observationDetail: 'Text om startsidan' },
                            },
                        },
                    },
                },
            },
        },
    ];

    test('hittar duplicerade grupper', () => {
        const groups = find_duplicate_observation_groups(current_samples);
        expect(groups).toHaveLength(1);
        expect(groups[0].entries).toHaveLength(2);
    });

    test('bygger patch när backup hade skilda texter', () => {
        const patches = build_observation_restore_patches(current_samples, backup_samples);
        expect(patches).toHaveLength(2);
        expect(patches.map((p) => p.backup_text).sort()).toEqual([
            'Text om cookiebannern',
            'Text om startsidan',
        ]);
    });

    test('applicerar patch på samples', () => {
        const samples = JSON.parse(JSON.stringify(current_samples));
        const patches = build_observation_restore_patches(samples, backup_samples);
        const applied = apply_observation_restore_patches(samples, patches);
        expect(applied).toBe(2);
        expect(find_duplicate_observation_groups(samples)).toHaveLength(0);
    });

    test('bygger full patch för alla avvikande observationer', () => {
        const current = JSON.parse(JSON.stringify(current_samples));
        current[1].requirementResults.krav_rubriker.checkResults['1'].passCriteria['1.3'].observationDetail =
            'Fel kopia på startsidan';
        const patches = build_full_observation_restore_patches(current, backup_samples);
        expect(patches.length).toBeGreaterThanOrEqual(1);
        expect(patches.some((p) => p.sample_id === 's2' && p.backup_text === 'Text om startsidan')).toBe(true);
    });
});
