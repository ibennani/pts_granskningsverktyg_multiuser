/**
 * @fileoverview Dev: läser/sparar Vite-klienttid i sessionStorage och jämför med build-info.
 * HMR-registrering ligger i vite_dev_client_timestamp_hmr.ts (import.meta — undviker Jest-parserfel).
 */

export const VITE_DEV_LAST_TS_STORAGE_KEY = 'gv_vite_client_last_ts';

/**
 * Läser senast inspelade Vite-klienttid från sessionStorage (satt före full omladdning eller vid HMR).
 */
export function read_vite_dev_client_timestamp_date (): Date | null {
    try {
        const raw = sessionStorage.getItem(VITE_DEV_LAST_TS_STORAGE_KEY);
        if (!raw) return null;
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        const d = new Date(n);
        return Number.isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}

/**
 * Väljer vilket ögonblick som ska visas i dev: senaste av BUILD_INFO och Vite-klientstämpel.
 */
export function resolve_dev_build_display_moment (
    build_info_iso: string | undefined,
    vite_client_date: Date | null
): Date {
    const from_build = build_info_iso ? new Date(build_info_iso) : null;
    const build_ok = from_build && !Number.isNaN(from_build.getTime()) ? from_build : null;
    const from_vite =
        vite_client_date instanceof Date && !Number.isNaN(vite_client_date.getTime())
            ? vite_client_date
            : null;
    if (build_ok && from_vite) {
        return build_ok > from_vite ? build_ok : from_vite;
    }
    if (build_ok) return build_ok;
    if (from_vite) return from_vite;
    return new Date();
}
