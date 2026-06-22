/**

 * @fileoverview Delar upp granskningar i grupper för grupperad listvy.

 */



/** Minimal radform för gruppering. */

export interface AuditRowForGrouping {

    id?: string | number;

    metadata?: {

        caseNumber?: string;

        actorName?: string;

        auditorName?: string;

        startTime?: string;

        [key: string]: unknown;

    };

    created_at?: string;

    updated_at?: string;

    [key: string]: unknown;

}



export interface AuditListGroup {

    group_key: string;

    audits: AuditRowForGrouping[];

}



/** @deprecated Använd AuditListGroup */

export type AuditCaseGroup = AuditListGroup;



export type AuditListGroupMode = 'case' | 'auditor';



/** Returnerar trimmat diarienummer från granskningens metadata. */

export function normalize_case_number(audit: AuditRowForGrouping): string {

    return (audit.metadata?.caseNumber ?? '').toString().trim();

}



/** Returnerar trimmat granskarnamn från granskningens metadata. */

export function normalize_auditor_name(audit: AuditRowForGrouping): string {

    return (audit.metadata?.auditorName ?? '').toString().trim();

}



/** Sorteringsnyckel: tomma värden hamnar sist. */

export function empty_last_sort_key(value: string): string {

    return value || '\uffff';

}



/** Sorteringsnyckel: tomma diarienummer hamnar sist. */

export function case_number_sort_key(case_number: string): string {

    return empty_last_sort_key(case_number);

}



/** Sorteringsnyckel för äldst till nyast inom en grupp. */

export function audit_age_sort_key(audit: AuditRowForGrouping): string {

    const created = audit.created_at ?? audit.metadata?.startTime ?? audit.updated_at ?? '';

    return created ? String(created) : '\uffff';

}



/** Returnerar den äldsta granskningen i en grupp (skapad först). */

export function get_oldest_audit_in_group(audits: AuditRowForGrouping[]): AuditRowForGrouping | null {

    if (!audits.length) return null;

    return [...audits].sort((a, b) => {

        const age_cmp = audit_age_sort_key(a).localeCompare(audit_age_sort_key(b));

        if (age_cmp !== 0) return age_cmp;

        return String(a.id ?? '').localeCompare(String(b.id ?? ''), undefined, { numeric: true });

    })[0] ?? null;

}



/** Aktörsnamn från den äldsta granskningen i gruppen. */

export function format_group_actor_names(audits: AuditRowForGrouping[]): string {

    const oldest = get_oldest_audit_in_group(audits);

    return (oldest?.metadata?.actorName ?? '').toString().trim();

}



/** Sorteringsvärde för aktörskolumn i grupprad. */

export function get_group_actor_sort_value(audits: AuditRowForGrouping[]): string {

    return format_group_actor_names(audits);

}



/** Sorteringsnyckel för äldst till nyast (senast ändrad, sedan skapad). */

export function audit_recency_sort_key(audit: AuditRowForGrouping): string {

    const ts = audit.updated_at ?? audit.created_at ?? audit.metadata?.startTime ?? '';

    return ts ? String(ts) : '\uffff';

}



/** Sorterar granskningar inom en grupp (äldst först, nyast sist). */

export function sort_audits_within_group(audits: AuditRowForGrouping[]): AuditRowForGrouping[] {

    return [...audits].sort((a, b) => {

        const recency_cmp = audit_recency_sort_key(a).localeCompare(audit_recency_sort_key(b));

        if (recency_cmp !== 0) return recency_cmp;

        return String(a.id ?? '').localeCompare(String(b.id ?? ''), undefined, { numeric: true });

    });

}



function partition_audits_by_key(

    audits: AuditRowForGrouping[],

    get_key: (audit: AuditRowForGrouping) => string

): { singles: AuditRowForGrouping[]; groups: AuditListGroup[] } {

    const by_key = new Map<string, AuditRowForGrouping[]>();

    const singles_no_key: AuditRowForGrouping[] = [];



    for (const audit of audits) {

        const key = get_key(audit);

        if (!key) {

            singles_no_key.push(audit);

            continue;

        }

        const list = by_key.get(key) ?? [];

        list.push(audit);

        by_key.set(key, list);

    }



    const singles: AuditRowForGrouping[] = [...singles_no_key];

    const groups: AuditListGroup[] = [];



    for (const [group_key, list] of by_key.entries()) {

        if (list.length >= 2) {

            groups.push({ group_key, audits: sort_audits_within_group(list) });

        } else if (list[0]) {

            singles.push(list[0]);

        }

    }



    return { singles, groups };

}



/**

 * Delar upp granskningar: ensamma eller utan diarienummer → singles;

 * två eller fler med samma diarienummer → groups.

 */

export function partition_audits_for_display(audits: AuditRowForGrouping[]): {

    singles: AuditRowForGrouping[];

    groups: AuditListGroup[];

} {

    return partition_audits_by_key(audits, normalize_case_number);

}



/** Delar upp granskningar per granskare (minst två med samma namn → grupp). */

export function partition_audits_by_auditor(audits: AuditRowForGrouping[]): {

    singles: AuditRowForGrouping[];

    groups: AuditListGroup[];

} {

    return partition_audits_by_key(audits, normalize_auditor_name);

}



function sort_groups_by_key(

    groups: AuditListGroup[],

    sort_key_fn: (key: string) => string

): AuditListGroup[] {

    return [...groups].sort((a, b) =>

        sort_key_fn(a.group_key).localeCompare(sort_key_fn(b.group_key), undefined, { numeric: true })

    );

}



/** Bygger grupper per diarienummer (minst två granskningar). */

export function build_audit_case_groups(audits: AuditRowForGrouping[]): AuditListGroup[] {

    const { groups } = partition_audits_for_display(audits);

    return sort_groups_by_key(groups, case_number_sort_key);

}



/** Bygger grupper per granskare (minst två granskningar). */

export function build_audit_auditor_groups(audits: AuditRowForGrouping[]): AuditListGroup[] {

    const { groups } = partition_audits_by_auditor(audits);

    return sort_groups_by_key(groups, empty_last_sort_key);

}



/** Bygger grupper för valt grupperingsläge. */

export function build_audit_list_groups(

    audits: AuditRowForGrouping[],

    mode: AuditListGroupMode

): AuditListGroup[] {

    return mode === 'auditor' ? build_audit_auditor_groups(audits) : build_audit_case_groups(audits);

}



/** Antal granskningar i synliga granskargrupper (för sektionsrubrik). */

export function count_audits_in_auditor_groups(audits: AuditRowForGrouping[]): number {

    return build_audit_auditor_groups(audits).reduce((sum, group) => sum + group.audits.length, 0);

}


