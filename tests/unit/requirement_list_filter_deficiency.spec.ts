import { describe, test, expect } from '@jest/globals';
import { filter_requirements } from '../../js/components/requirements_list/requirement_list_filter_requirements.js';

const req_with_27_in_text = {
    id: 'req-a',
    key: 'req-a',
    title: 'Krav med 27 i titeln men utan brist-id'
};

const req_with_b27 = {
    id: 'req-b',
    key: 'req-b',
    title: 'Krav med brist'
};

const sample_b27 = {
    id: 'sp1',
    requirementResults: {
        'req-b': {
            checkResults: {
                c1: {
                    passCriteria: {
                        p1: { status: 'failed', deficiencyId: 'B27' }
                    }
                }
            }
        }
    }
};

describe('filter_requirements brist-id-sökning', () => {
    test('låst granskning: sök 27 visar endast krav med brist B27, inte krav där 27 finns i text', () => {
        const entries: [string, typeof req_with_b27][] = [
            ['req-a', req_with_27_in_text],
            ['req-b', req_with_b27]
        ];
        const relevant = new Map([['sp1', new Set(['req-a', 'req-b'])]]);
        const { filtered_items } = filter_requirements(
            entries,
            { searchText: '27', status: {} },
            {
                mode: 'all',
                samples: [sample_b27],
                relevant_ids_by_sample: relevant,
                AuditLogic: {},
                requirements: {},
                audit_frozen: true
            }
        );
        expect(filtered_items).toHaveLength(1);
        expect(filtered_items[0][0]).toBe('req-b');
    });

    test('låst granskning: under krav visas endast stickprov med brist-id (inte alla stickprov för kravet)', () => {
        const sample_without_b27 = {
            id: 'sp2',
            description: 'Stickprov utan brist 27',
            requirementResults: {
                'req-b': {
                    checkResults: {
                        c1: { passCriteria: { p1: { status: 'passed' } } }
                    }
                }
            }
        };
        const entries: [string, typeof req_with_b27][] = [['req-b', req_with_b27]];
        const relevant = new Map([
            ['sp1', new Set(['req-b'])],
            ['sp2', new Set(['req-b'])]
        ]);
        const { filtered_items } = filter_requirements(
            entries,
            { searchText: '27', status: {} },
            {
                mode: 'all',
                samples: [sample_b27, sample_without_b27],
                relevant_ids_by_sample: relevant,
                AuditLogic: {},
                requirements: {},
                audit_frozen: true
            }
        );
        expect(filtered_items).toHaveLength(1);
        expect(filtered_items[0][0]).toBe('req-b');
    });

    test('pågående granskning: sök 27 använder textsök, inte brist-id', () => {
        const entries: [string, typeof req_with_b27][] = [
            ['req-a', req_with_27_in_text],
            ['req-b', req_with_b27]
        ];
        const relevant = new Map([['sp1', new Set(['req-a', 'req-b'])]]);
        const { filtered_items } = filter_requirements(
            entries,
            { searchText: '27', status: {} },
            {
                mode: 'all',
                samples: [sample_b27],
                relevant_ids_by_sample: relevant,
                AuditLogic: {},
                requirements: {},
                audit_frozen: false
            }
        );
        expect(filtered_items.map(([id]) => id)).toContain('req-a');
        expect(filtered_items.map(([id]) => id)).not.toContain('req-b');
    });
});
