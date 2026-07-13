/**
 * @file Versionsetiketter för regelfilstabellen (list-API-rader).
 */

export type RuleTableListRow = {
    content_metadata_version?: string | null;
    draft_version?: string | null;
    version_display?: string | null;
    has_draft?: boolean;
};

/** Arbetskopia: alltid version från content (samma som i regelfilsredigeraren). */
export function arbetskopia_version_label(row: RuleTableListRow | null | undefined): string {
    const from_content = row?.content_metadata_version;
    if (from_content != null && String(from_content).trim() !== '') return String(from_content).trim();
    const draft = row?.draft_version;
    if (draft != null && String(draft).trim() !== '') return String(draft).trim();
    const display = row?.version_display;
    if (display != null && String(display).trim() !== '') return String(display).trim();
    return '';
}

/** Publicerad regel: utkastets version om has_draft, annars publicerad version_display. */
export function published_row_version_label(row: RuleTableListRow | null | undefined): string {
    if (row?.has_draft === true && row.draft_version != null && String(row.draft_version).trim() !== '') {
        return String(row.draft_version).trim();
    }
    const display = row?.version_display;
    if (display != null && String(display).trim() !== '') return String(display).trim();
    return '';
}
