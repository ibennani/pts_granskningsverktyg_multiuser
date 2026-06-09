/**
 * @fileoverview Policy för massåtgärder som sätter krav till "ingen anmärkning":
 * ogranskade och delvis granskade krav där ohanterade kontrollpunkter ska fyllas i.
 */

/**
 * @param status Effektiv kravstatus från `get_effective_requirement_audit_status`
 * @returns true om kravet får påverkas av bulk till "ingen anmärkning"
 */
export function effective_status_is_fully_unreviewed_for_bulk_pass(status: string | null | undefined): boolean {
    return status === 'not_audited' || status === 'partially_audited';
}
