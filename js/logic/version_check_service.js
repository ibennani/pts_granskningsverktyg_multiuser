// js/logic/version_check_service.js
// Kontrollerar periodiskt om en ny version av appen har deployats. Visar kritisk meddelanderuta med knapp (ingen nedräkning).
// Kör endast periodisk kontroll när fliken är synlig – webbläsare throttlar timers i bakgrunden, då syns inte meddelandet förrän användaren växlar tillbaka.
// Jämför alltid server-mot-server (senast hämtad build vs nu hämtad) så att cachad script-tagg inte ger falska notiser.

import { getState } from '../state.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { clear_same_origin_sw_and_caches } from '../utils/clear_same_origin_sw_and_caches.js';

const INITIAL_DELAY_MS = 5000;
// Cooldown efter att användaren sett/klickat på notisen – undviker att den dyker upp igen direkt efter omladdning
const NOTIFICATION_COOLDOWN_MS = 180000; // 3 minuter
const NOTIFICATION_COOLDOWN_KEY = 'gv_version_notification_shown';

// Intervall: 60 s på produktion (minskar cache-beteende), 30 s lokalt
const is_production = typeof window !== 'undefined' && window.location.hostname === 'ux-granskningsverktyg.pts.ad';
const EFFECTIVE_CHECK_INTERVAL_MS = is_production ? 60000 : 30000;

/**
 * Bygger en omladdnings-URL som behåller path + query + hash, men uppdaterar/adderar
 * en cache-busting-parameter så att omladdningen inte fastnar på gamla resurser.
 *
 * @param {string} current_href
 * @param {number} now_ms
 * @returns {string}
 */
export function build_reload_url(current_href, now_ms) {
    try {
        const url = new URL(current_href, window.location.origin);
        url.searchParams.set('__reload', String(now_ms));
        const pathname = url.pathname || '/';
        return pathname + url.search + url.hash;
    } catch (_) {
        const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '/';
        const hash = (typeof window !== 'undefined' && window.location && window.location.hash) ? window.location.hash : '';
        return String(pathname || '/') + `?__reload=${encodeURIComponent(String(now_ms))}` + String(hash || '');
    }
}

/**
 * Fetch-options för att undvika att browserns HTTP-cache påverkar versionskontrollen.
 * @returns {{ cache: RequestCache }}
 */
export function get_build_info_fetch_options() {
    return { cache: 'no-store' };
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep_ms(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parse_build_info_from_text(text) {
    const start = text.indexOf('window.BUILD_INFO = ');
    if (start === -1) return null;
    const jsonStart = text.indexOf('{', start);
    if (jsonStart === -1) return null;
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) {
                jsonEnd = i;
                break;
            }
        }
    }
    if (jsonEnd === -1) return null;
    try {
        return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } catch (_) {
        return null;
    }
}

export function init_version_check_service() {
    if (typeof window === 'undefined') return;
    if (!window.BUILD_INFO?.timestamp) return;

    let check_timer = null;
    let already_shown = false;
    // Baseline från servern (senast bekräftad) – jämför mot detta istället för script-taggens BUILD_INFO som kan vara cachad
    let verified_server_timestamp = null;

    async function fetch_build_info_from_server() {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return null;
        }
        const url = `./build-info.js?t=${Date.now()}`;
        const res = await fetch(url, get_build_info_fetch_options());
        if (!res.ok) return null;
        const text = await res.text();
        return parse_build_info_from_text(text);
    }

    async function check_for_new_version() {
        if (already_shown) return;
        try {
            const cooldown = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(NOTIFICATION_COOLDOWN_KEY);
            if (cooldown) {
                const elapsed = Date.now() - Number(cooldown);
                if (elapsed >= 0 && elapsed < NOTIFICATION_COOLDOWN_MS) return;
            }
            const remote = await fetch_build_info_from_server();
            if (!remote?.timestamp) return;
            // Första gången: sätt baseline till vad servern har (ingen notis)
            if (verified_server_timestamp === null) {
                verified_server_timestamp = remote.timestamp;
                return;
            }
            // Visa endast om servern nu har en nyare build än vid senaste kontroll (inte jämfört med script-taggen)
            if (remote.timestamp <= verified_server_timestamp) {
                verified_server_timestamp = remote.timestamp;
                return;
            }
            verified_server_timestamp = remote.timestamp;
            already_shown = true;
            try {
                sessionStorage.setItem(NOTIFICATION_COOLDOWN_KEY, String(Date.now()));
            } catch (_) {
                // ignoreras medvetet
            }
            const msg = window.Translation?.t?.('new_version_available') || 'En ny version är tillgänglig.';
            const label = window.Translation?.t?.('reload_page') || 'Ladda om sidan';
            if (app_runtime_refs.notification_component?.show_global_critical_message_with_action) {
                app_runtime_refs.notification_component.show_global_critical_message_with_action(msg, 'warning', {
                    label,
                    callback: async () => {
                        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                            return;
                        }
                        try {
                            const state = getState();
                            const audit_id = state?.auditId;
                            if (audit_id && state?.ruleFileContent) {
                                const raw_base = (typeof window !== 'undefined' && window.__GV_API_BASE__) ? window.__GV_API_BASE__ : '/v2/api';
                                const api_base = String(raw_base).replace(/\/$/, '');
                                let headers = { 'Content-Type': 'application/json' };
                                try {
                                    const token = typeof window !== 'undefined' && window.sessionStorage
                                        ? window.sessionStorage.getItem('gv_auth_token')
                                        : null;
                                    if (token) {
                                        headers = {
                                            ...headers,
                                            Authorization: `Bearer ${token}`
                                        };
                                    }
                                } catch (_) {
                                    // Om sessionStorage inte är tillgängligt fortsätter vi utan auth-header.
                                }
                                await fetch(`${api_base}/backup/save-audit`, {
                                    method: 'POST',
                                    headers,
                                    body: JSON.stringify({ auditId: audit_id })
                                });
                            }
                        } catch (_) {
                            // Vid fel försöker vi ändå ladda om till ny version utan att störa användaren.
                        }
                        // Workbox/VitePWA kan annars servera gamla filer från precache utan hård omladdning.
                        await clear_same_origin_sw_and_caches();
                        await sleep_ms(50);
                        const next_url = build_reload_url(window.location.href, Date.now());
                        window.location.replace(next_url);
                    }
                });
            }
        } catch (_) {
            // Tyst – nätverksfel eller parse-fel
        }
    }

    function schedule_next_check() {
        if (check_timer) clearTimeout(check_timer);
        if (document.visibilityState !== 'visible') return;
        check_timer = setTimeout(() => {
            check_for_new_version();
            schedule_next_check();
        }, EFFECTIVE_CHECK_INTERVAL_MS);
    }

    function start_periodic_check() {
        if (document.visibilityState !== 'visible') return;
        check_for_new_version();
        schedule_next_check();
    }

    function stop_periodic_check() {
        if (check_timer) {
            clearTimeout(check_timer);
            check_timer = null;
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            check_for_new_version();
            schedule_next_check();
        } else {
            stop_periodic_check();
        }
    });

    // Sätt baseline från servern direkt så att första jämförelsen inte använder cachad data
    if (typeof navigator === 'undefined' || navigator.onLine) {
        fetch_build_info_from_server().then((info) => {
            if (info?.timestamp) verified_server_timestamp = info.timestamp;
        }).catch(() => {});
    }

    if (document.visibilityState === 'visible') {
        check_timer = setTimeout(start_periodic_check, INITIAL_DELAY_MS);
    } else {
        check_timer = setTimeout(() => {
            if (document.visibilityState === 'visible') start_periodic_check();
        }, INITIAL_DELAY_MS);
    }

    return {
        disconnect() {
            stop_periodic_check();
        }
    };
}
