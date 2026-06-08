/**
 * @fileoverview Hård omladdning: rensar service worker och cache, valfri säkerhetskopia,
 * och navigerar med cache-busting så att nya JS/CSS/HTML hämtas från servern.
 */

import { clear_same_origin_sw_and_caches } from './clear_same_origin_sw_and_caches.js';
import { build_reload_url } from './build_reload_url.js';
import { save_audit_backup_before_reload } from './save_audit_backup_before_reload.js';

const RELOAD_SETTLE_MS = 50;

export type HardReloadPageOptions = {
    /** Sparar pågående granskning till servern före omladdning */
    save_audit_backup?: boolean;
    /** Avbryt helt om webbläsaren rapporterar offline (t.ex. versionsnotis) */
    abort_when_offline?: boolean;
};

function sleep_ms(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prefetch_reload_document(reload_path: string): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        return;
    }
    try {
        const absolute = new URL(reload_path, window.location.origin).href;
        await fetch(absolute, {
            cache: 'no-store',
            credentials: 'same-origin',
            redirect: 'follow'
        });
    } catch {
        /* fortsätt med omladdning */
    }
}

/**
 * Tömmer cache och service worker, valfritt säkerhetskopierar granskning, och laddar om sidan.
 * Stärkare än webbläsarens hårda omladdning (Ctrl+Shift+F5) genom explicit SW-/cache-rensning
 * och cache-busting i URL:en.
 */
export async function hard_reload_page(options: HardReloadPageOptions = {}): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }
    if (options.abort_when_offline && typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
    }
    if (options.save_audit_backup) {
        await save_audit_backup_before_reload();
    }
    await clear_same_origin_sw_and_caches();
    await sleep_ms(RELOAD_SETTLE_MS);
    await clear_same_origin_sw_and_caches();
    const next_url = build_reload_url(window.location.href, Date.now());
    await prefetch_reload_document(next_url);
    window.location.replace(next_url);
}
