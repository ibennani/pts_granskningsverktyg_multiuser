/**
 * Unikt id per flik (sessionStorage) för BroadcastChannel — undviker ekon tillbaka till avsändaren.
 * @module js/utils/tab_origin_id
 */

let _tab_origin_id = null;

/**
 * @returns {string}
 */
export function get_tab_origin_id() {
    if (_tab_origin_id) return _tab_origin_id;
    try {
        const storage_key = 'gv_tab_sync_origin';
        let id = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(storage_key) : null;
        if (!id) {
            id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            sessionStorage.setItem(storage_key, id);
        }
        _tab_origin_id = id;
    } catch {
        _tab_origin_id = `t-${Date.now()}`;
    }
    return _tab_origin_id;
}
