/**
 * @fileoverview Policy för massåtgärder som sätter krav till "ingen anmärkning":
 * endast helt ogranskade (`not_audited`). Delvis granskade ska aldrig ändras av bulk-flöden.
 */

/**
 * @param status Effektiv kravstatus från `get_effective_requirement_audit_status`
 * @returns true om kravet får sättas via bulk till lagrat "ingen anmärkning"-resultat
 */
export function effective_status_is_fully_unreviewed_for_bulk_pass(status: string | null | undefined): boolean {
    return status === 'not_audited';
}
