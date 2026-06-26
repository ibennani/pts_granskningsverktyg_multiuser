/**
 * @file Monterar «ny version»-banner efter vyns h1 (samma ruta som regelfilsnotis på översikten).
 */

import * as Helpers from '../utils/helpers.js';
import {
    build_critical_notice_banner,
    build_version_reload_banner_row,
    VERSION_RELOAD_BANNER_ID
} from '../utils/critical_notice_banner_ui.js';
import {
    get_version_reload_prompt,
    VERSION_RELOAD_PROMPT_EVENT
} from './version_reload_prompt_state.js';
import { get_current_view_name } from '../app/browser_globals.js';

/**
 * Tar bort fristående versionsbanner om den finns.
 * @param {ParentNode|null|undefined} host
 */
export function remove_version_reload_banner_from_host(host) {
    if (!host) {
        return;
    }
    host.querySelector(`#${VERSION_RELOAD_BANNER_ID}`)?.remove();
}

/**
 * Visar eller uppdaterar versionsbanner direkt efter första h1 i vyn.
 * @param {HTMLElement|null|undefined} host
 */
export function sync_version_reload_banner_in_host(host) {
    if (!host) {
        return;
    }

    remove_version_reload_banner_from_host(host);

    const prompt = get_version_reload_prompt();
    if (!prompt) {
        return;
    }

    const t = typeof window !== 'undefined' && window.Translation?.t ? window.Translation.t.bind(window.Translation) : (key) => key;
    const row = build_version_reload_banner_row(Helpers, {
        message: prompt.message,
        reload_label: t('reload_page'),
        on_reload: () => {
            void prompt.on_reload();
        }
    });
    const banner = build_critical_notice_banner(Helpers, [row], { id: VERSION_RELOAD_BANNER_ID });

    const h1 = host.querySelector('h1');
    if (h1?.parentNode) {
        h1.parentNode.insertBefore(banner, h1.nextSibling);
        return;
    }
    host.insertBefore(banner, host.firstChild);
}

let sync_initialized = false;

/**
 * Uppdaterar versionsbanner i aktuell vy när prompt sätts (utom översikt som renderar om sig).
 */
export function init_version_reload_banner_live_sync() {
    if (sync_initialized || typeof document === 'undefined') {
        return;
    }
    sync_initialized = true;
    document.addEventListener(VERSION_RELOAD_PROMPT_EVENT, () => {
        if (get_current_view_name() === 'audit_overview') {
            return;
        }
        const main_el = document.getElementById('app-main-view-root');
        const host = main_el?.querySelector('#app-main-view-content') ?? main_el;
        sync_version_reload_banner_in_host(host instanceof HTMLElement ? host : null);
    });
}
