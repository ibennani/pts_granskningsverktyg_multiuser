/**
 * @fileoverview Hjälpfunktioner för tabellpaginering (radantal per sida och sidindex).
 */

/** Tolka val från listrutan: null betyder «alla rader». */
export function audit_page_size_string_to_number(value: string | undefined | null): number | null {
    const v = String(value ?? '').trim().toLowerCase();
    if (v === 'all' || v === 'alla') return null;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) return 10;
    return n;
}

export function total_pages(total_rows: number, page_size: number | null): number {
    if (total_rows <= 0) return 1;
    if (page_size === null) return 1;
    return Math.max(1, Math.ceil(total_rows / page_size));
}

/** Nollbaserat sidindex som alltid ligger inom [0, total_pages-1]. */
export function clamp_page_index(page: number, total_rows: number, page_size: number | null): number {
    const tp = total_pages(total_rows, page_size);
    const p = Number.isFinite(page) ? Math.floor(page) : 0;
    return Math.min(Math.max(0, p), tp - 1);
}

/** Inklusive start/slut (1-baserat i retur för visning). */
export function visible_row_range_one_based(
    page: number,
    page_size: number | null,
    total_rows: number
): { start: number; end: number } {
    if (total_rows <= 0) return { start: 0, end: 0 };
    if (page_size === null) return { start: 1, end: total_rows };
    const clamped = clamp_page_index(page, total_rows, page_size);
    const start0 = clamped * page_size;
    const end0 = Math.min(total_rows - 1, start0 + page_size - 1);
    return { start: start0 + 1, end: end0 + 1 };
}

export function slice_rows_for_page<T>(sorted_rows: T[], page: number, page_size: number | null): T[] {
    if (page_size === null) return sorted_rows;
    const total = sorted_rows.length;
    const clamped = clamp_page_index(page, total, page_size);
    const start = clamped * page_size;
    return sorted_rows.slice(start, start + page_size);
}
