/**
 * @fileoverview Taxonomikolumner för Bilaga 2 i granskning (vy och redigering).
 * Använder samma taxonomival som Excel-exporten.
 */
import { get_primary_taxonomy_export_columns } from '../export/export_format_helpers.js';

/**
 * Rubriker för taxonomikolumner i Bilaga 2 enligt granskningens grupperingstaxonomi.
 */
export function resolve_appendix2_taxonomy_column_labels_for_audit(
    audit: Record<string, unknown> | null | undefined,
    t: (key: string) => string
): string[] {
    return get_primary_taxonomy_export_columns(audit, t).map((column) => column.header);
}
