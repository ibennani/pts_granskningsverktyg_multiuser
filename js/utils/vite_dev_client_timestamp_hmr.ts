/**
 * @fileoverview Dev: Vite HMR-lyssnare för att spara klienttid (import.meta — endast Vite, inte Jest).
 */
/// <reference types="vite/client" />

import { VITE_DEV_LAST_TS_STORAGE_KEY } from './vite_dev_client_timestamp.js';

function record_vite_dev_client_now (): void {
    try {
        sessionStorage.setItem(VITE_DEV_LAST_TS_STORAGE_KEY, String(Date.now()));
    } catch {
        /* t.ex. privat läge */
    }
}

/**
 * Registrerar Vite HMR-lyssnare (endast när import.meta.hot finns).
 */
export function install_vite_dev_client_timestamp_listeners (on_update: () => void): void {
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
