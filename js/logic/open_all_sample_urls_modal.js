/**
 * @fileoverview Modal som bekräftar innan unika stickprovs-URL:er (http/https) öppnas:
 * antal = unika adresser, lika många about:blank-flikar, sedan location med intervall.
 */

import * as HelpersModule from '../utils/helpers.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';

/**
 * Rå sträng från stickprovets url-fält (flera nycklar för importerad data, icke-sträng).
 * @param {Record<string, unknown>|null|undefined} sample
 * @returns {string}
 */
export function sample_url_raw_string(sample) {
    if (!sample) return '';
    const v = sample.url ?? sample.URL ?? sample.sampleUrl ?? sample.link;
    if (v == null || v === '') return '';
    if (typeof v === 'string') return v.trim();
    return String(v).trim();
}

function looks_like_dangerous_url_scheme(raw) {
    return /^(javascript|data|vbscript):/i.test(raw.trim());
}

/**
 * Endast http/https som kan öppnas i ny flik (samma riktlinje som säkra länkar).
 * @param {string} href
 * @returns {string|null}
 */
export function canonical_http_open_href(href) {
    if (!href) return null;
    try {
        const u = new URL(href);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return u.href;
    } catch {
        return null;
    }
}

/**
 * Stickprov i ordning → en flik per giltig http(s)-adress (ingen dedupe; samma URL kan förekomma flera gånger).
 * @param {Array<Record<string, unknown>>|undefined} samples
 * @param {(raw: string) => string} add_protocol_fn
 * @returns {{ ordered_hrefs: string[], has_duplicate_open_urls: boolean }}
 */
export function collect_ordered_sample_open_hrefs(samples, add_protocol_fn) {
    const ordered_hrefs = [];
    for (const s of samples || []) {
        const raw = sample_url_raw_string(s);
        if (!raw) continue;
        if (looks_like_dangerous_url_scheme(raw)) continue;
        const href = add_protocol_fn(raw);
        const canonical = canonical_http_open_href(href);
        if (!canonical) continue;
        ordered_hrefs.push(canonical);
    }
    const uniq = new Set(ordered_hrefs);
    const has_duplicate_open_urls = uniq.size < ordered_hrefs.length;
    return { ordered_hrefs, has_duplicate_open_urls };
}

/**
 * Unika URL:er (dedupe) + metadata – används i tester och där unika behövs.
 * @param {Array<Record<string, unknown>>|undefined} samples
 * @param {(raw: string) => string} add_protocol_fn
 * @returns {{ unique_urls: string[], samples_with_url_count: number, has_duplicate_urls: boolean }}
 */
export function collect_unique_sample_open_urls(samples, add_protocol_fn) {
    const { ordered_hrefs, has_duplicate_open_urls } = collect_ordered_sample_open_hrefs(samples, add_protocol_fn);
    const seen = new Set();
    const unique_urls = [];
    for (const h of ordered_hrefs) {
        if (seen.has(h)) continue;
        seen.add(h);
        unique_urls.push(h);
    }
    return {
        unique_urls,
        samples_with_url_count: ordered_hrefs.length,
        has_duplicate_urls: has_duplicate_open_urls
    };
}

/**
 * Fyller modalens .modal-message med fet förstarad + övriga stycken (utan innerHTML med data).
 * @param {HTMLElement} msg_p
 * @param {Function} create_el - Helpers.create_element
 * @param {Function} t - Translation.t
 * @param {number} tab_count
 * @param {boolean} has_duplicate_urls
 */
export function fill_open_all_sample_urls_modal_message(msg_p, create_el, t, tab_count, has_duplicate_urls) {
    msg_p.replaceChildren();
    const strong_text = tab_count === 1
        ? t('open_all_sample_urls_modal_intro_one_lead')
        : t('open_all_sample_urls_modal_intro_many_lead', { count: tab_count });
    const tail_text = tab_count === 1
        ? t('open_all_sample_urls_modal_intro_one_tail')
        : t('open_all_sample_urls_modal_intro_many_tail');
    msg_p.appendChild(create_el('strong', { text_content: strong_text }));
    msg_p.appendChild(document.createTextNode(tail_text));
    msg_p.appendChild(create_el('br'));
    msg_p.appendChild(create_el('br'));
    msg_p.appendChild(document.createTextNode(t('open_all_sample_urls_modal_browser_note')));
    if (has_duplicate_urls) {
        msg_p.appendChild(create_el('br'));
        msg_p.appendChild(create_el('br'));
        msg_p.appendChild(document.createTextNode(t('open_all_sample_urls_modal_shared_urls_note')));
    }
    msg_p.appendChild(create_el('br'));
    msg_p.appendChild(create_el('br'));
    msg_p.appendChild(document.createTextNode(t('open_all_sample_urls_modal_trust_note')));
}

/** Sekund mellan varje fliks navigation till måladress (efter att tomma flikar öppnats). */
const NAVIGATE_INTERVAL_MS = 1000;

/**
 * Öppnar en tom flik per unik href, sätter sedan rätt URL i varje (samma ordning som listan).
 * @param {string[]} hrefs - kanoniska unika http(s)-URL:er
 * @param {number} [navigate_interval_ms]
 */
export function open_http_hrefs_via_blank_then_assign(hrefs, navigate_interval_ms = NAVIGATE_INTERVAL_MS) {
    if (!hrefs?.length) return;
    const windows = [];
    for (let i = 0; i < hrefs.length; i += 1) {
        const w = window.open('about:blank', '_blank');
        windows.push(w || null);
        if (w) try { w.opener = null; } catch (_) { /* noop */ }
    }
    hrefs.forEach((href, index) => {
        setTimeout(() => {
            const safe = canonical_http_open_href(href);
            const win = windows[index];
            if (!safe || !win || win.closed) return;
            try {
                win.location.href = safe;
            } catch (_) { /* noop */ }
        }, index * navigate_interval_ms);
    });
}

function attach_open_all_sample_urls_modal_body(container, modal, ctx) {
    const { create_el, t, focus_target, tab_count, has_duplicate_urls, getState, add_protocol } = ctx;
    const msg_p = container.querySelector('p.modal-message');
    if (msg_p) {
        fill_open_all_sample_urls_modal_message(msg_p, create_el, t, tab_count, has_duplicate_urls);
    }
    const buttons_wrapper = create_el('div', { class_name: 'modal-confirm-actions' });
    const open_btn = create_el('button', {
        class_name: ['button', 'button-primary'],
        text_content: t('open_all_sample_urls_confirm_button')
    });
    let confirm_already_handled = false;
    open_btn.addEventListener('click', () => {
        if (confirm_already_handled) return;
        confirm_already_handled = true;
        const samples_now = typeof getState === 'function' ? getState().samples : [];
        const { unique_urls } = collect_unique_sample_open_urls(samples_now, add_protocol);
        open_http_hrefs_via_blank_then_assign(unique_urls);
        modal.close(focus_target);
    });
    const later_btn = create_el('button', {
        class_name: ['button', 'button-secondary'],
        text_content: t('open_all_sample_urls_later_button')
    });
    later_btn.addEventListener('click', () => modal.close(focus_target));
    buttons_wrapper.append(open_btn, later_btn);
    container.appendChild(buttons_wrapper);
}

/**
 * Visar modal och öppnar stickprovens URL:er vid bekräftelse (färsk state vid klick).
 * @param {Object} opts
 * @param {HTMLElement|null} opts.trigger_element
 * @param {() => { samples?: Array<Record<string, unknown>> }} opts.getState
 * @param {Object} opts.Helpers
 * @param {Object} opts.Translation
 */
export function show_open_all_sample_urls_modal({
    trigger_element,
    getState,
    Helpers,
    Translation
}) {
    const ModalComponent = app_runtime_refs.modal_component;
    const t = Translation?.t || (k => k);
    const create_el = Helpers?.create_element;
    const add_protocol = Helpers?.add_protocol_if_missing || HelpersModule.add_protocol_if_missing;

    if (!ModalComponent?.show || !create_el || typeof getState !== 'function') return;

    const samples_initial = getState().samples;
    const { unique_urls, has_duplicate_urls } = collect_unique_sample_open_urls(samples_initial, add_protocol);
    if (unique_urls.length === 0) return;

    const focus_target = trigger_element && document.contains(trigger_element) ? trigger_element : null;
    const ctx = {
        create_el,
        t,
        focus_target,
        tab_count: unique_urls.length,
        has_duplicate_urls,
        getState,
        add_protocol
    };

    ModalComponent.show(
        { h1_text: t('open_all_sample_urls_modal_title'), message_text: '' },
        (container, modal) => attach_open_all_sample_urls_modal_body(container, modal, ctx)
    );
}
