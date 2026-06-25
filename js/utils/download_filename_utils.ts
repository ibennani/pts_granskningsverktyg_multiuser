/**
 * Enda klientkälla för tidsstämplar och säkra segment i nedladdningsfilnamn.
 *
 * Tidszon: Europe/Stockholm (via shared/datetime/filename_datetime.js).
 * Nya nedladdningsfunktioner ska alltid importera härifrån — se .cursor/rules/12-nedladdningsfilnamn-tid.mdc
 */

import {
    format_filename_date_for_download,
    format_filename_datetime_from_iso,
    parse_iso_to_date,
} from '../../shared/datetime/filename_datetime.js';
import {
    FILE_DOWNLOAD_MAX_BYTES,
} from '../../shared/constants/file_download_limits.js';

export { FILE_DOWNLOAD_MAX_BYTES } from '../../shared/constants/file_download_limits.js';
export { format_file_download_max_size_label } from '../../shared/constants/file_download_limits.js';

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

const _cache_by_iso = new Map<string, string>();

function _normalize_iso_for_cache(iso: string | null | undefined): string {
    return String(iso || '').trim();
}

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

/**
 * Datum+tid för filnamn: YYYYMMDD_HHMMSS i svensk tid (Europe/Stockholm).
 *
 * @param iso - Valfri ISO-tid att formatera. Saknas/null = aktuell tid (nedladdningsögonblick).
 */
export function get_download_filename_datetime(iso?: string | null): string {
    const cache_key = _normalize_iso_for_cache(iso);
    if (cache_key && _cache_by_iso.has(cache_key)) {
        return _cache_by_iso.get(cache_key) || format_filename_datetime_from_iso(iso ?? undefined);
    }
    const v = format_filename_datetime_from_iso(iso ?? undefined);
    if (cache_key) {
        _cache_by_iso.set(cache_key, v);
    }
    return v;
}

/**
 * Endast datum för filnamn i svensk tid.
 *
 * @param iso - Valfri ISO-tid. Saknas/null = idag (vid nedladdning).
 * @param separator - T.ex. `'-'` ger YYYY-MM-DD, tom sträng ger YYYYMMDD.
 */
export function get_download_filename_date(iso?: string | null, separator = '-'): string {
    const parsed = iso ? parse_iso_to_date(iso) : null;
    return format_filename_date_for_download(parsed ?? new Date(), separator);
}

/**
 * Som get_download_filename_datetime men med reservvärde när iso saknas eller är ogiltig.
 */
export function get_download_filename_datetime_or_fallback(
    iso: string | null | undefined,
    fallback = 'saknad-tidpunkt'
): string {
    if (!iso || !parse_iso_to_date(iso)) {
        return fallback;
    }
    return get_download_filename_datetime(iso);
}

/**
 * @deprecated Använd get_download_filename_datetime (synkron). Behålls för gradvis migrering.
 */
export async function get_server_filename_datetime(iso?: string | null): Promise<string | null> {
    try {
        return get_download_filename_datetime(iso);
    } catch (e) {
        console.error('[download_filename_utils] get_download_filename_datetime error:', e);
        return null;
    }
}

export type TriggerBrowserBlobDownloadOptions = {
    /** Dold temporärlänk (används t.ex. vid backup-nedladdning). */
    aria_hidden?: boolean;
};

export const FILE_DOWNLOAD_TOO_LARGE_CODE = 'FILE_DOWNLOAD_TOO_LARGE';

export class DownloadFileTooLargeError extends Error {
    readonly code = FILE_DOWNLOAD_TOO_LARGE_CODE;

    constructor(
        public readonly byte_size: number,
        public readonly max_bytes: number = FILE_DOWNLOAD_MAX_BYTES
    ) {
        super(FILE_DOWNLOAD_TOO_LARGE_CODE);
        this.name = 'DownloadFileTooLargeError';
    }
}

export function is_download_file_too_large_error(error: unknown): error is DownloadFileTooLargeError {
    if (error instanceof DownloadFileTooLargeError) return true;
    if (error && typeof error === 'object' && 'code' in error) {
        return (error as { code?: string }).code === FILE_DOWNLOAD_TOO_LARGE_CODE;
    }
    return false;
}

/**
 * Kastar om blob överskrider maxstorlek för nedladdning.
 */
export function assert_download_blob_within_limit(blob: Blob): void {
    if (blob.size > FILE_DOWNLOAD_MAX_BYTES) {
        throw new DownloadFileTooLargeError(blob.size, FILE_DOWNLOAD_MAX_BYTES);
    }
}

/**
 * Startar nedladdning av en Blob i webbläsaren (temporär länk).
 * Kastar DownloadFileTooLargeError om filen överskrider FILE_DOWNLOAD_MAX_BYTES.
 */
export function trigger_browser_blob_download(
    blob: Blob,
    filename: string,
    options: TriggerBrowserBlobDownloadOptions = {}
): void {
    assert_download_blob_within_limit(blob);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    if (options.aria_hidden) {
        link.setAttribute('aria-hidden', 'true');
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
