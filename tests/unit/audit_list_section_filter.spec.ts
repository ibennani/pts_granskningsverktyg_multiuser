/**
 * @fileoverview Enhetstester för filterlogik i granskningslistans sektioner.
 */

import {
    build_audit_list_section_configs,
    filter_audits_by_current_user,
    filter_audits_by_type,
    sort_audits_by_case_number
} from '../../js/logic/audit_list_section_filter.ts';

function make_audit(
    id: number,
    status: string,
    metadata: Record<string, string> = {},
    audit_type = ''
) {
    return { id, status, metadata, audit_type };
}

describe('build_audit_list_section_configs', () => {
    it('visar alla sektioner utan filter och sorterar på ärendenummer', () => {
        const ctx = {
            audit_filter_query: '',
            audit_type_filter: '',
            audits: [
                make_audit(2, 'in_progress', { caseNumber: 'B 10', actorName: 'Beta' }),
                make_audit(1, 'in_progress', { caseNumber: 'A 2', actorName: 'Alfa' })
            ]
        };
        const result = build_audit_list_section_configs(ctx);
        expect(result.has_text_filter).toBe(false);
        expect(result.has_type_filter).toBe(false);
        expect(result.has_active_filter).toBe(false);
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
        expect(result.has_text_filter).toBe(true);
        expect(result.has_active_filter).toBe(true);
        expect(result.section_configs[0].audits.map((a) => a.id)).toEqual([1]);
        expect(result.section_configs[1].audits).toEqual([]);
        expect(result.section_configs[2].audits.map((a) => a.id)).toEqual([3]);
    });

    it('filtrerar rubrik och tabell på granskningstyp', () => {
        const ctx = {
            audit_filter_query: '',
            audit_type_filter: 'webb',
            audits: [
                make_audit(1, 'in_progress', { caseNumber: '1' }, 'webb'),
                make_audit(2, 'in_progress', { caseNumber: '2' }, 'app'),
                make_audit(3, 'not_started', { caseNumber: '3' }, 'webb')
            ]
        };
        const result = build_audit_list_section_configs(ctx);
        expect(result.has_type_filter).toBe(true);
        expect(result.has_active_filter).toBe(true);
        expect(result.section_configs[0].audits.map((a) => a.id)).toEqual([1]);
        expect(result.section_configs[0].heading_audits.map((a) => a.id)).toEqual([1]);
        expect(result.section_configs[1].audits.map((a) => a.id)).toEqual([3]);
    });

    it('visar bara inloggad användares granskningar i läget mine', () => {
        sessionStorage.setItem('gv_current_user_name', 'Anna Granskare');
        const ctx = {
            audit_filter_query: '',
            audit_type_filter: '',
            audit_list_group_mode: 'mine',
            audits: [
                make_audit(1, 'in_progress', { caseNumber: '1', auditorName: 'Anna Granskare' }),
                make_audit(2, 'in_progress', { caseNumber: '2', auditorName: 'Bob' }),
                make_audit(3, 'not_started', { caseNumber: '3', auditorName: 'Anna Granskare' })
            ]
        };
        const result = build_audit_list_section_configs(ctx);
        expect(result.section_configs[0].audits.map((a) => a.id)).toEqual([1]);
        expect(result.section_configs[1].audits.map((a) => a.id)).toEqual([3]);
        sessionStorage.removeItem('gv_current_user_name');
    });
});

describe('filter_audits_by_current_user', () => {
    it('matchar granskare case-insensitive mot sessionStorage', () => {
        sessionStorage.setItem('gv_current_user_name', 'Anna Granskare');
        const list = [
            make_audit(1, 'in_progress', { auditorName: 'anna granskare' }),
            make_audit(2, 'in_progress', { auditorName: 'Bob' })
        ];
        expect(filter_audits_by_current_user(list).map((a) => a.id)).toEqual([1]);
        sessionStorage.removeItem('gv_current_user_name');
    });

    it('returnerar tom lista utan inloggad användare', () => {
        sessionStorage.removeItem('gv_current_user_name');
        const list = [make_audit(1, 'in_progress', { auditorName: 'Anna' })];
        expect(filter_audits_by_current_user(list)).toEqual([]);
    });
});

describe('filter_audits_by_type', () => {
    it('returnerar ofiltrerad lista när typ saknas', () => {
        const list = [make_audit(1, 'in_progress', {}, 'webb')];
        expect(filter_audits_by_type(list, '')).toEqual(list);
    });
});

describe('sort_audits_by_case_number', () => {
    it('sorterar numeriskt på ärendenummer', () => {
        const sorted = sort_audits_by_case_number([
            make_audit(2, 'in_progress', { caseNumber: '10' }),
            make_audit(1, 'in_progress', { caseNumber: '2' })
        ]);
        expect(sorted.map((a) => a.id)).toEqual([1, 2]);
    });
});
