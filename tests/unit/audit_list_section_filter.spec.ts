/**
 * @fileoverview Enhetstester för filterlogik i granskningslistans sektioner.
 */

import {
    build_audit_list_section_configs,
    collect_granskningstyp_filter_options,
    count_secondary_filters,
    filter_audits_by_current_user,
    filter_audits_by_granskningstyp,
    filter_audits_by_type,
    has_list_narrowing_filter,
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
            granskningstyp_filter: 'tillsyn-lptt',
            audits: [
                make_audit(1, 'in_progress', { auditTypeId: 'tillsyn-lptt', auditTypeLabel: 'Tillsyn' }),
                make_audit(2, 'in_progress', { auditTypeId: 'marknadskontroll-lptt', auditTypeLabel: 'MK' }),
                make_audit(3, 'not_started', { auditTypeId: 'tillsyn-lptt', auditTypeLabel: 'Tillsyn' })
            ]
        };
        const result = build_audit_list_section_configs(ctx);
        expect(result.has_active_filter).toBe(true);
        expect(result.section_configs[0].audits.map((a) => a.id)).toEqual([1]);
        expect(result.section_configs[1].audits.map((a) => a.id)).toEqual([3]);
    });

    it('filtrerar rubrik och tabell på media-typ webb/pdf', () => {
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

describe('collect_granskningstyp_filter_options', () => {
    it('returnerar standardtyper även utan granskningar', () => {
        const options = collect_granskningstyp_filter_options([]);
        expect(options.map((o) => o.id)).toEqual([
            'marknadskontroll-lptt',
            'tillsyn-lptt'
        ]);
    });

    it('slår ihop dynamiska typer från granskningar med standard', () => {
        const options = collect_granskningstyp_filter_options([
            make_audit(1, 'in_progress', { auditTypeId: 'custom-type', auditTypeLabel: 'Anpassad' })
        ]);
        expect(options.map((o) => o.id)).toContain('custom-type');
        expect(options.map((o) => o.id)).toContain('tillsyn-lptt');
    });
});

describe('filter_audits_by_granskningstyp', () => {
    it('returnerar ofiltrerad lista när filter saknas', () => {
        const list = [make_audit(1, 'in_progress', { auditTypeId: 'tillsyn-lptt' })];
        expect(filter_audits_by_granskningstyp(list, '')).toEqual(list);
    });

    it('filtrerar på auditTypeId i metadata', () => {
        const list = [
            make_audit(1, 'in_progress', { auditTypeId: 'tillsyn-lptt' }),
            make_audit(2, 'in_progress', { auditTypeId: 'marknadskontroll-lptt' })
        ];
        expect(filter_audits_by_granskningstyp(list, 'tillsyn-lptt').map((a) => a.id)).toEqual([1]);
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

describe('count_secondary_filters', () => {
    it('returnerar 0 när alla sekundära filter är standard', () => {
        expect(
            count_secondary_filters({
                audits: [],
                granskningstyp_filter: '',
                audit_type_filter: '',
                audit_list_group_mode: 'all',
                audit_table_page_size: 'all'
            })
        ).toBe(0);
    });

    it('räknar granskningstyp, medium, visningsläge och sidstorlek', () => {
        expect(
            count_secondary_filters({
                audits: [],
                granskningstyp_filter: 'tillsyn-lptt',
                audit_type_filter: 'webb',
                audit_list_group_mode: 'mine',
                audit_table_page_size: '10'
            })
        ).toBe(4);
    });

    it('räknar inte söktext', () => {
        expect(
            count_secondary_filters({
                audits: [],
                audit_filter_query: 'alfa',
                audit_type_filter: ''
            })
        ).toBe(0);
    });
});

describe('has_list_narrowing_filter', () => {
    it('är sant vid söktext', () => {
        expect(
            has_list_narrowing_filter({
                audits: [],
                audit_filter_query: 'test'
            })
        ).toBe(true);
    });

    it('är sant vid visningsläge mine', () => {
        expect(
            has_list_narrowing_filter({
                audits: [],
                audit_list_group_mode: 'mine'
            })
        ).toBe(true);
    });

    it('är falskt utan avgränsande filter', () => {
        expect(
            has_list_narrowing_filter({
                audits: [],
                audit_filter_query: '',
                audit_type_filter: '',
                granskningstyp_filter: '',
                audit_list_group_mode: 'all',
                audit_table_page_size: 'all'
            })
        ).toBe(false);
    });
});

describe('build_audit_list_section_configs filter counts', () => {
    it('returnerar secondary_filter_count och has_list_narrowing_filter', () => {
        const result = build_audit_list_section_configs({
            audit_filter_query: 'alfa',
            audit_type_filter: 'webb',
            audit_list_group_mode: 'all',
            audits: [make_audit(1, 'in_progress', { caseNumber: '1', actorName: 'Alfa AB' }, 'webb')]
        });
        expect(result.secondary_filter_count).toBe(1);
        expect(result.has_list_narrowing_filter).toBe(true);
        expect(result.has_active_filter).toBe(true);
    });
});
