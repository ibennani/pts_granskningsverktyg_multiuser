// js/logic/version_check_service.js
// Kontrollerar periodiskt om en ny version av appen har deployats. Visar kritisk meddelanderuta med knapp (ingen nedräkning).
// Kör endast periodisk kontroll när fliken är synlig – webbläsare throttlar timers i bakgrunden, då syns inte meddelandet förrän användaren växlar tillbaka.

const CHECK_INTERVAL_MS = 30000;
const INITIAL_DELAY_MS = 5000;

export function init_version_check_service() {
    if (typeof window === 'undefined') return;

    const current_timestamp = window.BUILD_INFO?.timestamp;
    if (!current_timestamp) return;

    let check_timer = null;
    let already_shown = false;

    async function check_for_new_version() {
        if (already_shown) return;
        try {
            const url = `./build-info.js?t=${Date.now()}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return;
            const text = await res.text();
            const start = text.indexOf('window.BUILD_INFO = ');
            if (start === -1) return;
            const jsonStart = text.indexOf('{', start);
            if (jsonStart === -1) return;
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
            if (jsonEnd === -1) return;
            const remote = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
            if (remote?.timestamp && remote.timestamp !== current_timestamp) {
                already_shown = true;
                const msg = window.Translation?.t?.('new_version_available') || 'En ny version är tillgänglig.';
                const label = window.Translation?.t?.('reload_page') || 'Ladda om sidan';
                if (window.NotificationComponent?.show_global_critical_message_with_action) {
                    window.NotificationComponent.show_global_critical_message_with_action(msg, 'warning', {
                        label,
                        callback: () => window.location.reload()
                    });
                }
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
        }, CHECK_INTERVAL_MS);
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
