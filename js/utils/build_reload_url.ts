/**
 * @fileoverview Bygger omladdnings-URL med cache-busting utan att tappa path, query eller hash.
 */

/**
 * @param current_href Fullständig eller relativ URL för aktuell sida
 * @param now_ms Tidsstämpel för cache-busting-parameter
 * @returns Path + query + hash med uppdaterad __reload-parameter
 */
export function build_reload_url(current_href: string, now_ms: number): string {
    try {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const url = new URL(current_href, origin);
        url.searchParams.set('__reload', String(now_ms));
        const pathname = url.pathname || '/';
        return pathname + url.search + url.hash;
    } catch {
        const pathname = (typeof window !== 'undefined' && window.location?.pathname)
            ? window.location.pathname
            : '/';
        const hash = (typeof window !== 'undefined' && window.location?.hash)
            ? window.location.hash
            : '';
        return String(pathname || '/')
            + `?__reload=${encodeURIComponent(String(now_ms))}`
            + String(hash || '');
    }
}
