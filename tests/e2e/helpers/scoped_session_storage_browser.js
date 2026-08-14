/**
 * Laddas i E2E via page.addInitScript({ path }) före övriga seed-skript.
 */
window.gv_scope_storage_key = function gv_scope_storage_key(base_key, base_path) {
    const path_arg = base_path || (typeof window !== 'undefined' && window.location
        ? window.location.pathname.replace(/\/[^/]*$/, '') || '/v2'
        : '/v2');
    const trimmed = String(path_arg || '/').replace(/\/+$/, '') || '/';
    const ns = trimmed === '/' ? 'root' : trimmed.replace(/^\//, '');
    return `gv:${ns}:${String(base_key || '').trim()}`;
};
