/**
 * Flyttar gamla `?view=…`-länkar till hash-routing vid kallstart.
 * Importerar endast kodar-funktioner (ingen router) för att undvika cykliska beroenden.
 * @module js/logic/migrate_legacy_query_to_hash
 */

import { build_compact_hash_fragment } from './router_url_codec.js';

/**
 * Om `window.location.search` innehåller `view`, byggs motsvarande hash och övriga
 * parameterrader flyttas till fragmentet. Debug `?debug=nav` lämnas kvar i search.
 *
 * @returns true om migration utfördes
 */
export function migrate_legacy_view_query_to_hash(win: Window & typeof globalThis): boolean {
    const pathname = win.location.pathname.split('?')[0].split('#')[0];
    const search_raw = win.location.search || '';
    const sp = new URLSearchParams(search_raw.startsWith('?') ? search_raw.slice(1) : '');
    const view_raw = sp.get('view');
    if (!view_raw) return false;

    const hash_route_params: Record<string, string> = {};
    for (const [k, v] of sp.entries()) {
        if (k === 'view' || k === 'debug') continue;
        hash_route_params[k] = v;
    }

    const fragment_body = build_compact_hash_fragment(view_raw, hash_route_params);
    let new_search = '';
    if (sp.get('debug') === 'nav') {
        new_search = '?debug=nav';
    }
    try {
        const new_url = pathname + new_search + '#' + fragment_body;
        win.history.replaceState(null, '', new_url);
    } catch {
        return false;
    }
    return true;
}
