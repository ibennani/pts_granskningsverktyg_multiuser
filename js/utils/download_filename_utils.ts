/**
 * Gemensamma hjälpfunktioner för konsekventa nedladdningsfilnamn.
 *
 * Fokus:
 * - Filnamnsvänliga segment (Windows-kompatibla).
 * - Tidsstämpel i formatet YYYYMMDD_HHMMSS beräknad i serverns lokala tid.
 */

import { api_get } from '../api/client.js';

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * Tar bort tecken som är ogiltiga i filnamn på Windows och trimmar.
 */
export function sanitize_filename_segment(segment: string, replacement = '_'): string {
    const s = String(segment || '').trim();
    return s
        .replace(UNSAFE_FILENAME_CHARS, replacement)
        .replace(/\s+/g, '_')
        .trim();
}

type ServerFilenameDatetimeResponse = {
    filename_datetime?: string;
    now_local_iso?: string;
};

const _cache_by_iso = new Map<string, string>();

function _normalize_iso_for_cache(iso: string | null | undefined): string {
    const s = String(iso || '').trim();
    return s;
}

/**
 * Hämtar filnamnsvänlig datum+tid (YYYYMMDD_HHMMSS) i serverns lokala tid.
 *
 * - Om `iso` anges formateras den tidpunkten i serverns lokala tid.
 * - Om `iso` saknas används serverns \"nu\".
 */
export async function get_server_filename_datetime(iso?: string | null): Promise<string | null> {
    const cache_key = _normalize_iso_for_cache(iso);
    if (cache_key && _cache_by_iso.has(cache_key)) {
        return _cache_by_iso.get(cache_key) || null;
    }

    const qs = cache_key ? `?iso=${encodeURIComponent(cache_key)}` : '';
    try {
        const data = (await api_get(`/time/filename-datetime${qs}`)) as ServerFilenameDatetimeResponse;
        const v = typeof data?.filename_datetime === 'string' ? data.filename_datetime.trim() : '';
        if (!v) return null;
        if (cache_key) _cache_by_iso.set(cache_key, v);
        return v;
    } catch (e) {
        console.error('[download_filename_utils] get_server_filename_datetime fetch error:', e);
        return null;
    }
}

