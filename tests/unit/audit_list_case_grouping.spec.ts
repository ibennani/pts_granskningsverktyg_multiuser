import {
    build_audit_auditor_groups,
    build_audit_case_groups,
    build_audit_list_groups,
    count_audits_in_auditor_groups,
    format_group_actor_names,
    normalize_auditor_name,
    normalize_case_number,
    partition_audits_by_auditor,
    partition_audits_for_display,
    sort_audits_within_group
} from '../../js/logic/audit_list_case_grouping.js';

describe('audit_list_case_grouping', () => {
    test('normalize_case_number trimmar metadata', () => {
        expect(normalize_case_number({ metadata: { caseNumber: '  ABC-1  ' } })).toBe('ABC-1');
        expect(normalize_case_number({ metadata: {} })).toBe('');
    });

    test('normalize_auditor_name trimmar metadata', () => {
        expect(normalize_auditor_name({ metadata: { auditorName: '  Anna  ' } })).toBe('Anna');
        expect(normalize_auditor_name({ metadata: {} })).toBe('');
    });

    test('partition_audits_for_display grupperar endast vid minst två med samma nummer', () => {
        const a1 = { id: '1', metadata: { caseNumber: 'D-100', actorName: 'Aktör A' } };
        const a2 = { id: '2', metadata: { caseNumber: 'D-100', actorName: 'Aktör B' } };
        const a3 = { id: '3', metadata: { caseNumber: 'D-200', actorName: 'Ensam' } };
        const a4 = { id: '4', metadata: { actorName: 'Utan nummer' } };

        const { singles, groups } = partition_audits_for_display([a1, a2, a3, a4]);

        expect(singles).toHaveLength(2);
        expect(singles.map((s) => s.id)).toEqual(expect.arrayContaining(['3', '4']));
        expect(groups).toHaveLength(1);
        expect(groups[0].group_key).toBe('D-100');
        expect(groups[0].audits.map((a) => a.id)).toEqual(expect.arrayContaining(['1', '2']));
    });

    test('partition_audits_by_auditor grupperar endast vid minst två med samma granskare', () => {
        const a1 = { id: '1', metadata: { auditorName: 'Leffe', caseNumber: 'A-1' } };
        const a2 = { id: '2', metadata: { auditorName: 'Leffe', caseNumber: 'A-2' } };
        const a3 = { id: '3', metadata: { auditorName: 'Solo', caseNumber: 'B-1' } };

        const { singles, groups } = partition_audits_by_auditor([a1, a2, a3]);

        expect(singles).toHaveLength(1);
        expect(singles[0].id).toBe('3');
        expect(groups).toHaveLength(1);
        expect(groups[0].group_key).toBe('Leffe');
        expect(groups[0].audits).toHaveLength(2);
    });

    test('sort_audits_within_group sorterar på aktör', () => {
        const audits = [
            { id: 'b', metadata: { actorName: 'Beta' } },
            { id: 'a', metadata: { actorName: 'Alfa' } }
        ];
        const sorted = sort_audits_within_group(audits);
        expect(sorted.map((a) => a.id)).toEqual(['a', 'b']);
    });

    test('format_group_actor_names använder aktör från äldsta granskningen', () => {
        const name = format_group_actor_names([
            { id: '2', created_at: '2024-02-01', metadata: { actorName: 'Nyare aktör' } },
            { id: '1', created_at: '2024-01-01', metadata: { actorName: 'Äldsta aktör' } },
            { id: '3', created_at: '2024-03-01', metadata: { actorName: 'Senaste aktör' } }
        ]);
        expect(name).toBe('Äldsta aktör');
    });

    test('format_group_actor_names faller tillbaka till startTime när created_at saknas', () => {
        const name = format_group_actor_names([
            { id: 'b', metadata: { actorName: 'Beta', startTime: '2024-06-01' } },
            { id: 'a', metadata: { actorName: 'Alfa', startTime: '2024-01-01' } }
        ]);
        expect(name).toBe('Alfa');
    });

    test('build_audit_case_groups returnerar bara grupper sorterade på diarienummer', () => {
        const groups = build_audit_case_groups([
            { id: 'z', metadata: { caseNumber: 'Z-9' } },
            { id: 'a', metadata: { caseNumber: 'A-1' } },
            { id: '1', metadata: { caseNumber: 'B-2', actorName: 'X' } },
            { id: '2', metadata: { caseNumber: 'B-2', actorName: 'Y' } }
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].group_key).toBe('B-2');
        expect(groups[0].audits).toHaveLength(2);
    });

    test('build_audit_auditor_groups returnerar grupper sorterade på granskare', () => {
        const groups = build_audit_auditor_groups([
            { id: '1', metadata: { auditorName: 'Zara' } },
            { id: '2', metadata: { auditorName: 'Zara' } },
            { id: '3', metadata: { auditorName: 'Anna' } },
            { id: '4', metadata: { auditorName: 'Anna' } }
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0].group_key).toBe('Anna');
        expect(groups[1].group_key).toBe('Zara');
    });

    test('build_audit_list_groups väljer läge', () => {
        const audits = [
            { id: '1', metadata: { auditorName: 'Leffe', caseNumber: 'X' } },
            { id: '2', metadata: { auditorName: 'Leffe', caseNumber: 'Y' } }
        ];
        expect(build_audit_list_groups(audits, 'auditor')).toHaveLength(1);
        expect(build_audit_list_groups(audits, 'case')).toHaveLength(0);
    });

    test('count_audits_in_auditor_groups summerar granskningar i synliga grupper', () => {
        const audits = [
            { id: '1', metadata: { auditorName: 'Anna' } },
            { id: '2', metadata: { auditorName: 'Anna' } },
            { id: '3', metadata: { auditorName: 'Anna' } },
            { id: '4', metadata: { auditorName: 'Bob' } },
            { id: '5', metadata: { auditorName: 'Cecilia' } }
        ];
        expect(build_audit_auditor_groups(audits)).toHaveLength(1);
        expect(count_audits_in_auditor_groups(audits)).toBe(3);
    });
});
