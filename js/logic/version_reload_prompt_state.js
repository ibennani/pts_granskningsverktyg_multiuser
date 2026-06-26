/**
 * @file Tillstånd för «ny app-version»-notis (delad mellan vyer).
 * Visas i samma orange ruta som erbjudande om nyare regelfil.
 */

/** @typedef {{ message: string, on_reload: () => void }} VersionReloadPrompt */

/** @type {VersionReloadPrompt|null} */
let pending_prompt = null;

/** @type {Set<(prompt: VersionReloadPrompt|null) => void>} */
const listeners = new Set();

export const VERSION_RELOAD_PROMPT_EVENT = 'gv:version_reload_prompt';

/**
 * @returns {VersionReloadPrompt|null}
 */
export function get_version_reload_prompt() {
    return pending_prompt;
}

/**
 * @param {VersionReloadPrompt} prompt
 */
export function set_version_reload_prompt(prompt) {
    pending_prompt = prompt;
    listeners.forEach((fn) => {
        try {
            fn(pending_prompt);
        } catch {
            /* ignoreras */
        }
    });
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent(VERSION_RELOAD_PROMPT_EVENT));
    }
}

export function clear_version_reload_prompt() {
    if (!pending_prompt) {
        return;
    }
    pending_prompt = null;
    listeners.forEach((fn) => {
        try {
            fn(null);
        } catch {
            /* ignoreras */
        }
    });
    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent(VERSION_RELOAD_PROMPT_EVENT));
    }
}

/**
 * @param {(prompt: VersionReloadPrompt|null) => void} listener
 * @returns {() => void}
 */
export function subscribe_version_reload_prompt(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
