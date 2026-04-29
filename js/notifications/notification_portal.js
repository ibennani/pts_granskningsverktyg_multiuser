/**
 * @file Placering av globala notisytor i huvudvärden och borttagning av dubbla id:n.
 */

import { ensure_main_view_content_host } from '../logic/app_dom.js';

export const GLOBAL_MESSAGE_CONTAINER_ID = 'global-message-area';
export const GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID = 'global-critical-message-area';

/**
 * Tar bort dubletter av samma id (lämnar kvar canonical-instanserna).
 * @param {HTMLElement} keep_critical
 * @param {HTMLElement} keep_regular
 */
function remove_duplicate_global_message_nodes(keep_critical, keep_regular) {
    document.querySelectorAll(`[id="${GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID}"]`).forEach((node) => {
        if (node !== keep_critical) {
            node.remove();
        }
    });
    document.querySelectorAll(`[id="${GLOBAL_MESSAGE_CONTAINER_ID}"]`).forEach((node) => {
        if (node !== keep_regular) {
            node.remove();
        }
    });
}

/**
 * Placerar kritisk + vanlig notis i #app-main-view-content ovanför vyns innehåll.
 * @param {HTMLElement|null} critical
 * @param {HTMLElement|null} regular
 */
export function append_global_message_areas_to_host(critical, regular) {
    if (!critical || !regular) {
        return;
    }

    const main_el = document.getElementById('app-main-view-root');
    if (!main_el) {
        [critical, regular].forEach((el) => {
            if (el && el.isConnected) {
                el.remove();
            }
        });
        return;
    }

    ensure_main_view_content_host(main_el);
    const host = main_el.querySelector('#app-main-view-content');
    if (!host) {
        [critical, regular].forEach((el) => {
            if (el && el.isConnected && !main_el.contains(el)) {
                el.remove();
            }
        });
        return;
    }

    const h1 = host.querySelector('h1');
    if (h1 && h1.parentNode) {
        h1.parentNode.insertBefore(critical, h1);
        h1.parentNode.insertBefore(regular, critical.nextSibling);
    } else {
        host.insertBefore(critical, host.firstChild);
        host.insertBefore(regular, critical.nextSibling);
    }

    remove_duplicate_global_message_nodes(critical, regular);
}
