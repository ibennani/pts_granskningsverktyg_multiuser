// js/translation_logic.js
'use strict';

import { escape_html } from './utils/helpers.js';

const translationModules = import.meta.glob('./i18n/*.json', { eager: true });

const supported_languages = {
    'sv-SE': 'Svenska (Sverige)',
    'en-GB': 'English (UK)',
    'nb-NO': 'Norsk bokmål (Norge)'
};

const DEFAULT_LANGUAGE_TAG = 'en-GB';

let current_language_tag = DEFAULT_LANGUAGE_TAG;
let loaded_translations = {};
let initial_load_promise = null;

function log(...args) {
    console.log('[Translation]', ...args);
}

function warn(...args) {
    console.warn('[Translation]', ...args);
}

function error(...args) {
    if (typeof window !== 'undefined' && window.ConsoleManager?.warn) {
        window.ConsoleManager.warn('[Translation]', ...args);
    }
}

function getModuleKey(lang_tag) {
    return `./i18n/${lang_tag}.json`;
}

/** Normaliserar BCP 47 (bindestreck, versaler för region). nb_NO → nb-NO så att DB/inställningar matchar. */
function normalize_bcp47_tag(tag) {
    if (tag == null || typeof tag !== 'string') {
        return DEFAULT_LANGUAGE_TAG;
    }
    let t = tag.trim().replace(/_/g, '-');
    if (!t) {
        return DEFAULT_LANGUAGE_TAG;
    }
    const segments = t.split('-');
    if (segments.length === 1) {
        return segments[0].toLowerCase();
    }
    const lang = segments[0].toLowerCase();
    const rest = segments.slice(1).map((seg) => {
        if (seg.length === 2 && /^[a-z]{2}$/i.test(seg)) {
            return seg.toUpperCase();
        }
        return seg;
    });
    return [lang, ...rest].join('-');
}

function get_translation_module_data(lang_tag) {
    const key = getModuleKey(lang_tag);
    if (translationModules[key]) {
        return translationModules[key];
    }
    const lower = key.toLowerCase();
    const found_key = Object.keys(translationModules).find((k) => k.toLowerCase() === lower);
    return found_key ? translationModules[found_key] : null;
}

function unwrap_translation_object(moduleData) {
    if (!moduleData) {
        return null;
    }
    const raw = moduleData.default !== undefined ? moduleData.default : moduleData;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }
    return raw;
}

function resolve_effective_language_tag(requested_tag) {
    const normalized = normalize_bcp47_tag(requested_tag);

    if (supported_languages[normalized]) {
        return normalized;
    }

    // Special handling for common language codes that should map to our supported variants
    const language_mappings = {
        'sv': 'sv-SE',  // Swedish maps to Swedish (Sweden)
        'en': 'en-GB',  // English maps to British English
        'nb': 'nb-NO'   // Norwegian Bokmål maps to Norwegian (Norway)
    };

    if (language_mappings[normalized]) {
        return language_mappings[normalized];
    }

    const base_lang = normalized.split('-')[0];
    const matching_supported_base = Object.keys(supported_languages).find(
        key => key === base_lang || key.startsWith(`${base_lang}-`)
    );
    if (matching_supported_base) {
        warn(`Language tag "${requested_tag}" (normaliserad: "${normalized}") stöds inte direkt. Använder "${matching_supported_base}".`);
        return matching_supported_base;
    }

    warn(`Language tag "${requested_tag}" (normaliserad: "${normalized}") stöds inte. Använder standard "${DEFAULT_LANGUAGE_TAG}".`);
    return DEFAULT_LANGUAGE_TAG;
}

async function load_language_file(lang_tag_to_load) {
    const effective_lang_tag = resolve_effective_language_tag(lang_tag_to_load || DEFAULT_LANGUAGE_TAG);
    const moduleData = get_translation_module_data(effective_lang_tag);

    if (!moduleData) {
        const moduleKey = getModuleKey(effective_lang_tag);
        error(`Ingen inbunden översättning för "${effective_lang_tag}" (modulnyckel: ${moduleKey}). Byter till standard.`);
        if (effective_lang_tag !== DEFAULT_LANGUAGE_TAG) {
            return load_language_file(DEFAULT_LANGUAGE_TAG);
        }
        // Use a hardcoded fallback translation key since we can't use Translation.t() here
        // This is the only exception where we need a hardcoded fallback
        loaded_translations = { 
            app_title: 'Audit Tool - Missing translations',
            translation_missing_translations: 'Audit Tool - Missing translations'
        };
        current_language_tag = DEFAULT_LANGUAGE_TAG;
        document.documentElement.lang = 'en';
        return loaded_translations;
    }

    const primary_obj = unwrap_translation_object(moduleData);
    if (!primary_obj) {
        error(`Ogiltigt format på översättningsmodul för "${effective_lang_tag}". Byter till standard.`);
        if (effective_lang_tag !== DEFAULT_LANGUAGE_TAG) {
            return load_language_file(DEFAULT_LANGUAGE_TAG);
        }
        loaded_translations = {
            app_title: 'Audit Tool - Missing translations',
            translation_missing_translations: 'Audit Tool - Missing translations'
        };
        current_language_tag = DEFAULT_LANGUAGE_TAG;
        document.documentElement.lang = 'en';
        return loaded_translations;
    }

    let merged = JSON.parse(JSON.stringify(primary_obj));

    // Ofullständiga språkfiler (t.ex. nb-NO): innehåll från vald fil ligger ovanpå en-GB; saknade nycklar blir engelska.
    if (effective_lang_tag !== DEFAULT_LANGUAGE_TAG) {
        const fallback_module_data = get_translation_module_data(DEFAULT_LANGUAGE_TAG);
        const fallback_obj = unwrap_translation_object(fallback_module_data);
        if (fallback_obj) {
            const fallback_copy = JSON.parse(JSON.stringify(fallback_obj));
            merged = { ...fallback_copy, ...merged };
        }
    }

    loaded_translations = merged;
    current_language_tag = effective_lang_tag;
    document.documentElement.lang = current_language_tag;

    log(`Loaded translations for "${current_language_tag}". app_title: "${loaded_translations['app_title']}"`);
    return loaded_translations;
}

export async function set_language(lang_tag) {
    log(`set_language called with: ${lang_tag}. Current: ${current_language_tag}`);
    await load_language_file(lang_tag);
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang_tag: current_language_tag } }));
}

export function t(key, replacements = {}) {
    const translation_value = loaded_translations?.[key];
    if (translation_value === undefined) {
        warn(`t(): Missing key "${key}" for lang "${current_language_tag}". Returning key.`);
        return `**${key}**`;
    }
    
    // Sanitize replacement values to prevent XSS
    const sanitized_replacements = {};
    for (const [replacement_key, replacement_value] of Object.entries(replacements)) {
        if (typeof replacement_value === 'string') {
            // Escape HTML in replacement values
            sanitized_replacements[replacement_key] = escape_html(replacement_value) || replacement_value;
        } else {
            sanitized_replacements[replacement_key] = replacement_value;
        }
    }
    
    return translation_value.replace(/{([^{}]+)}/g, (match, placeholder_key) => (
        sanitized_replacements[placeholder_key] !== undefined ? sanitized_replacements[placeholder_key] : match
    ));
}

export function get_current_language_code() {
    return current_language_tag;
}

export function get_supported_languages() {
    return { ...supported_languages };
}

function resolve_browser_language() {
    const navigator_lang = navigator.language || DEFAULT_LANGUAGE_TAG;
    return resolve_effective_language_tag(navigator_lang);
}

const initial_lang = resolve_browser_language();
log('Initial browser language resolved to:', initial_lang);
initial_load_promise = load_language_file(initial_lang);

export function ensure_initial_load() {
    return initial_load_promise;
}

log('Translation bootstrap completed.');
