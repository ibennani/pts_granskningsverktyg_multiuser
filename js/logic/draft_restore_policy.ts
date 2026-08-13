/**
 * @fileoverview När fältutkast ska hoppas över vid vyrender (t.ex. ny granskning med tom metadata).
 */

export type DraftRestoreAppState = {
    auditStatus?: string;
    freshNewAuditMetadata?: boolean;
};

/** Sant när sparade fältutkast inte ska skrivas tillbaka i DOM efter render. */
export function should_skip_draft_restore_for_view(
    view_name: string,
    state: DraftRestoreAppState | null | undefined
): boolean {
    if (view_name === 'bulk_sample_import') return true;
    if (!state || view_name !== 'metadata') return false;
    return state.auditStatus === 'not_started' && state.freshNewAuditMetadata === true;
}
