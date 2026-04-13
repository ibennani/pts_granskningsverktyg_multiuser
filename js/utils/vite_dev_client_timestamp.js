/**
 * @fileoverview Dev: sparar tidpunkt när Vites klient får uppdatering/omladdning så att
 * byggtexten kan följa Vites konsol (t.ex. omladdning p.g.a. coverage-HTML) även när
 * build-info-watcher inte ser filändringen.
 */

/** @type {string} */
export const VITE_DEV_LAST_TS_STORAGE_KEY = 'gv_vite_client_last_ts';

/**
 * Läser senast inspelade Vite-klienttid från sessionStorage (satt före full omladdning eller vid HMR).
 * @returns {Date|null}
 */
export function read_vite_dev_client_timestamp_date() {
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

function record_vite_dev_client_now() {
    try {
        sessionStorage.setItem(VITE_DEV_LAST_TS_STORAGE_KEY, String(Date.now()));
    } catch {
        /* t.ex. privat läge */
    }
}

/**
 * Väljer vilket ögonblick som ska visas i dev: senaste av BUILD_INFO och Vite-klientstämpel.
 * @param {string|undefined} build_info_iso - ISO från window.BUILD_INFO.timestamp
 * @param {Date|null} vite_client_date - Från read_vite_dev_client_timestamp_date()
 * @returns {Date}
 */
export function resolve_dev_build_display_moment(build_info_iso, vite_client_date) {
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

/**
 * Registrerar Vite HMR-lyssnare (endast när import.meta.hot finns).
 * @param {() => void} on_update - Anropas vid HMR (så DOM uppdateras utan full omladdning)
 */
export function install_vite_dev_client_timestamp_listeners(on_update) {
    if (typeof on_update !== 'function') return;
    if (!import.meta.hot) return;

    import.meta.hot.on('vite:beforeFullReload', () => {
        record_vite_dev_client_now();
    });
    import.meta.hot.on('vite:beforeUpdate', () => {
        record_vite_dev_client_now();
        on_update();
    });
}
