// js/logic/version_check_service.js
// Kontrollerar periodiskt om en ny version av appen har deployats. Visar kritisk meddelanderuta med knapp (ingen nedräkning).
// Periodisk kontroll körs bara när fliken är synlig (timers throttlas i bakgrunden).
// Direktkontroll vid fokus: visibilitychange (annan flik) och window focus (tillbaka från annat program).
// Jämför alltid server-mot-server (senast hämtad build vs nu hämtad) så att cachad script-tagg inte ger falska notiser.

import { build_reload_url } from '../utils/build_reload_url.js';
import { hard_reload_page } from '../utils/hard_reload_page.js';
import { set_version_reload_prompt } from './version_reload_prompt_state.js';

export { build_reload_url };

/**
 * Ny-versionsdialog ("En ny version är tillgänglig" / "Ladda om sidan").
 * Sätt till `false` innan du deployar om aktiva användare inte ska störas under bytet;
 * sätt till `true` igen i samma commit eller direkt efter lyckad deploy.
 */
export const ENABLE_VERSION_RELOAD_PROMPT = true;

const INITIAL_DELAY_MS = 5000;
/** Slår ihop visibilitychange + focus så samma fokus inte ger dubbla fetch i rad. */
const ACTIVE_CHECK_DEBOUNCE_MS = 100;
// Cooldown efter att användaren sett/klickat på notisen – undviker att den dyker upp igen direkt efter omladdning
const NOTIFICATION_COOLDOWN_MS = 180000; // 3 minuter
const NOTIFICATION_COOLDOWN_KEY = 'gv_version_notification_shown';

// Intervall: 60 s på produktion (minskar cache-beteende), 30 s lokalt
const is_production = typeof window !== 'undefined' && window.location.hostname === 'ux-granskningsverktyg.pts.ad';
const EFFECTIVE_CHECK_INTERVAL_MS = is_production ? 60000 : 30000;

/**
 * @param {string|null|undefined} local_timestamp
 * @param {string|null|undefined} remote_timestamp
 * @returns {boolean}
 */
export function is_remote_timestamp_newer(local_timestamp, remote_timestamp) {
    if (!local_timestamp || !remote_timestamp) return false;
    // ISO-tidsstämplar (YYYY-MM-DDTHH:mm:ss.sssZ) kan jämföras lexikografiskt.
    return String(remote_timestamp) > String(local_timestamp);
}

/**
 * Fetch-options för att undvika att browserns HTTP-cache påverkar versionskontrollen.
 * @returns {{ cache: RequestCache }}
 */
export function get_build_info_fetch_options() {
    return { cache: 'no-store' };
}

export function parse_build_info_from_text(text) {
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
    if (!ENABLE_VERSION_RELOAD_PROMPT) return;
    if (!window.BUILD_INFO?.timestamp) return;

    let check_timer = null;
    let active_check_debounce_timer = null;
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
            show_new_version_notification();
        } catch (_) {
            // Tyst – nätverksfel eller parse-fel
        }
    }

    function show_new_version_notification() {
        if (already_shown) return;
        already_shown = true;
        try {
            sessionStorage.setItem(NOTIFICATION_COOLDOWN_KEY, String(Date.now()));
        } catch (_) {
            // ignoreras medvetet
        }
        const msg = window.Translation?.t?.('new_version_available') || 'En ny version är tillgänglig.';
        set_version_reload_prompt({
            message: msg,
            on_reload: () => {
                void hard_reload_page({
                    save_audit_backup: true,
                    abort_when_offline: true
                });
            }
        });
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

    function clear_active_check_debounce() {
        if (active_check_debounce_timer) {
            clearTimeout(active_check_debounce_timer);
            active_check_debounce_timer = null;
        }
    }

    function run_version_check_on_page_active() {
        if (document.visibilityState !== 'visible') return;
        check_for_new_version();
        schedule_next_check();
    }

    function schedule_immediate_version_check_on_active() {
        if (document.visibilityState !== 'visible') return;
        clear_active_check_debounce();
        active_check_debounce_timer = setTimeout(() => {
            active_check_debounce_timer = null;
            run_version_check_on_page_active();
        }, ACTIVE_CHECK_DEBOUNCE_MS);
    }

    function on_visibility_change() {
        if (document.visibilityState === 'visible') {
            schedule_immediate_version_check_on_active();
        } else {
            clear_active_check_debounce();
            stop_periodic_check();
        }
    }

    document.addEventListener('visibilitychange', on_visibility_change);
    window.addEventListener('focus', schedule_immediate_version_check_on_active);

    // Sätt baseline från servern direkt så att första jämförelsen inte använder cachad data.
    // Viktigt: om användaren öppnar en GAMMAL cachad version efter deploy måste vi visa notisen direkt
    // (annars skulle baseline bli "nya servern" och då triggas aldrig uppdateringsnotisen).
    if (typeof navigator === 'undefined' || navigator.onLine) {
        fetch_build_info_from_server().then((info) => {
            if (!info?.timestamp) return;
            if (is_remote_timestamp_newer(window.BUILD_INFO?.timestamp, info.timestamp)) {
                verified_server_timestamp = info.timestamp;
                // Respektera cooldown även vid "direkt vid start"-fall.
                try {
                    const cooldown = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(NOTIFICATION_COOLDOWN_KEY);
                    if (cooldown) {
                        const elapsed = Date.now() - Number(cooldown);
                        if (elapsed >= 0 && elapsed < NOTIFICATION_COOLDOWN_MS) return;
                    }
                } catch (_) {
                    // ignoreras medvetet
                }
                show_new_version_notification();
                return;
            }
            verified_server_timestamp = info.timestamp;
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
            document.removeEventListener('visibilitychange', on_visibility_change);
            window.removeEventListener('focus', schedule_immediate_version_check_on_active);
            clear_active_check_debounce();
            stop_periodic_check();
        }
    };
}
