/**
 * @fileoverview Parsning och normalisering av URL-lista för bulkimport.
 */

export type BulkUrlRow = {
    line_number: number;
    raw: string;
    normalized_url: string | null;
    error_key: string | null;
};

export function normalize_bulk_url(
    raw: string,
    add_protocol?: (url: string) => string
): string | null {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return null;
    const with_protocol = add_protocol ? add_protocol(trimmed) : trimmed;
    try {
        const parsed = new URL(with_protocol);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        return parsed.href;
    } catch {
        return null;
    }
}

export function parse_bulk_url_list(
    text: string,
    add_protocol?: (url: string) => string
): BulkUrlRow[] {
    const lines = String(text || '').split(/\r?\n/);
    const seen = new Set<string>();
    const rows: BulkUrlRow[] = [];

    lines.forEach((line, index) => {
        const raw = line.trim();
        if (!raw) return;
        const normalized = normalize_bulk_url(raw, add_protocol);
        if (!normalized) {
            rows.push({
                line_number: index + 1,
                raw,
                normalized_url: null,
                error_key: 'bulk_url_import_invalid_url',
            });
            return;
        }
        if (seen.has(normalized)) {
            rows.push({
                line_number: index + 1,
                raw,
                normalized_url: null,
                error_key: 'bulk_url_import_duplicate_url',
            });
            return;
        }
        seen.add(normalized);
        rows.push({
            line_number: index + 1,
            raw,
            normalized_url: normalized,
            error_key: null,
        });
    });

    return rows;
}

export function count_valid_bulk_urls(rows: BulkUrlRow[]): number {
    return rows.filter((r) => r.normalized_url).length;
}
