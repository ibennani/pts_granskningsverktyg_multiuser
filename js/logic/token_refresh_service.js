/**
 * Bakgrundstjänst: förnyar JWT periodiskt så att kort access-TTL (t.ex. 1 h) inte avbryter arbetet oväntat.
 * @module js/logic/token_refresh_service
 */

import { get_auth_token, refresh_auth_token } from '../api/client.js';
import { consoleManager } from '../utils/console_manager.js';

const INTERVAL_MS = 50 * 60 * 1000;

/** @type {ReturnType<typeof setInterval> | null} */
let interval_id = null;

/**
 * Startar intervall (50 min) som anropar refresh när användaren har token.
 */
export function init_token_refresh_service() {
    if (typeof window === 'undefined') return;
    if (interval_id !== null) return;
    interval_id = window.setInterval(async () => {
        if (!get_auth_token()) return;
        const ok = await refresh_auth_token();
        if (!ok) {
            consoleManager.warn('[token_refresh] Kunde inte förnya sessionstoken automatiskt.');
        }
    }, INTERVAL_MS);
}
