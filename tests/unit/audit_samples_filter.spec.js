/**
 * @fileoverview Enhetstester för filtrering av granskningslistsektioner.
 */

import { build_audit_list_section_configs } from '../../js/components/audit_view/audit_samples_filter.js';

function make_audit(id, status, metadata = {}) {
    return { id, status, metadata };
}

describe('build_audit_list_section_configs', () => {
    it('visar alla sektioner utan filter och sorterar på ärendenummer', () => {
        const ctx = {
            audit_filter_query: '',
            audits: [
                make_audit(2, 'in_progress', { caseNumber: 'B 10', actorName: 'Beta' }),
                make_audit(1, 'in_progress', { caseNumber: 'A 2', actorName: 'Alfa' })
            ]
        };
        const result = build_audit_list_section_configs(ctx);
        expect(result.has_filter).toBe(false);
        expect(result.section_configs[0].audits.map((a) => a.id)).toEqual([1, 2]);
    });

    it('filtrerar på ärendenummer, aktör och granskare', () => {
        const ctx = {
            audit_filter_query: 'alfa',
            audits: [
                make_audit(1, 'in_progress', { caseNumber: '1', actorName: 'Alfa AB' }),
                make_audit(2, 'not_started', { caseNumber: '2', actorName: 'Beta' }),
                make_audit(3, 'locked', { caseNumber: '3', actorName: 'Gamma', auditorName: 'Alfa Granskare' })
            ]
        };
        const result = build_audit_list_section_configs(ctx);
        expect(result.has_filter).toBe(true);
        expect(result.section_configs[0].audits.map((a) => a.id)).toEqual([1]);
        expect(result.section_configs[1].audits).toEqual([]);
        expect(result.section_configs[2].audits.map((a) => a.id)).toEqual([3]);
    });
});
