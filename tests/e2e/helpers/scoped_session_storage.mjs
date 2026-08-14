/**
 * Hjälp för E2E: samma nyckel-prefix som js/utils/scoped_browser_storage.ts
 * (körs i webbläsarkontext via page.addInitScript).
 */
export function gv_scope_storage_key(base_key, base_path = '/v2') {
    const trimmed = String(base_path || '/').replace(/\/+$/, '') || '/';
    const ns = trimmed === '/' ? 'root' : trimmed.replace(/^\//, '');
    return `gv:${ns}:${String(base_key || '').trim()}`;
}

export function gv_seed_session_storage(items, base_path = '/v2') {
    if (typeof sessionStorage === 'undefined' || !items) return;
    Object.entries(items).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            sessionStorage.setItem(gv_scope_storage_key(key, base_path), String(value));
        }
    });
}
