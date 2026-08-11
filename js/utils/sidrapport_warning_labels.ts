/**
 * @fileoverview Svenska etiketter för varningskoder i sidrapporter.
 */

export type SidrapportWarning = { code: string; message: string };

const WARNING_I18N_KEYS: Record<string, string> = {
    ax_unavailable: 'audit_sidrapport_warning_ax_unavailable',
    dom_snapshot_unavailable: 'audit_sidrapport_warning_dom_snapshot_unavailable',
    mhtml_unavailable: 'audit_sidrapport_warning_mhtml_unavailable',
    frames_unavailable: 'audit_sidrapport_warning_frames_unavailable',
    source_html_unavailable: 'audit_sidrapport_warning_source_html_unavailable',
    resource_too_large: 'audit_sidrapport_warning_resource_too_large',
    body_unavailable: 'audit_sidrapport_warning_body_unavailable',
    extended_truncated: 'audit_sidrapport_warning_extended_truncated',
};

export function format_sidrapport_warning_label(
    warning: SidrapportWarning,
    t: (key: string, opts?: Record<string, unknown>) => string
): string {
    const key = WARNING_I18N_KEYS[warning.code];
    if (key) {
        return t(key);
    }
    return warning.message || warning.code;
}

/** Visar varje varningstyp högst en gång (äldre sidrapporter kan ha dubbletter). */
export function dedupe_sidrapport_warnings_for_display(
    warnings: SidrapportWarning[]
): SidrapportWarning[] {
    const seen = new Set<string>();
    const deduped: SidrapportWarning[] = [];
    for (const warning of warnings) {
        if (seen.has(warning.code)) continue;
        seen.add(warning.code);
        deduped.push(warning);
    }
    return deduped;
}
