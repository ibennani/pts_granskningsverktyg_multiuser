/**
 * Ger helpers och dependency_manager tillgång till översättningsmodulen utan
 * att importera translation_logic.js (Vite import.meta.glob fungerar inte i Jest).
 */

/** @type {null | { t?: function(string, object?): string }} */
let translation_module_ref = null;

/**
 * @param {object} translation_module - samma modul som translation_logic exporterar
 */
export function register_translation_module(translation_module) {
    translation_module_ref = translation_module;
}

/**
 * @returns {object|null}
 */
export function get_registered_translation_module() {
    return translation_module_ref;
}

/**
 * @returns {function(string, object?): string}
 */
export function get_translation_t() {
    if (translation_module_ref && typeof translation_module_ref.t === 'function') {
        return translation_module_ref.t.bind(translation_module_ref);
    }
    return (key) => `**${key}**`;
}

/**
 * @returns {string}
 */
export function get_current_language_code_from_registry() {
    const m = translation_module_ref;
    if (m && typeof m.get_current_language_code === 'function') {
        return m.get_current_language_code();
    }
    return 'en-GB';
}
