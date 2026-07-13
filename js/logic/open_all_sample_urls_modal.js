/**
 * @fileoverview Modal som bekräftar innan granskningsdels-URL:er (http/https) öppnas:
 * en about:blank-flik per granskningsdel med länk, redirect efter en sekund.
 */

import * as HelpersModule from '../utils/helpers.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';

/**
 * Rå sträng från granskningsdelens url-fält (flera nycklar för importerad data, icke-sträng).
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
 * Granskningsdelar i ordning → en flik per giltig http(s)-adress (ingen dedupe; samma URL kan förekomma flera gånger).
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
 * Fyller modaltext med antal flikar och påminnelse om att hitta tillbaka till den här fliken.
 * @param {HTMLElement} message_container
 * @param {Function} create_el - Helpers.create_element
 * @param {Function} t - Translation.t
 * @param {number} tab_count
 */
export function fill_open_all_sample_urls_modal_message(message_container, create_el, t, tab_count) {
    message_container.replaceChildren();
    const intro_p = create_el('p');
    const strong_text = tab_count === 1
        ? t('open_all_sample_urls_modal_intro_one_lead')
        : t('open_all_sample_urls_modal_intro_many_lead', { count: tab_count });
    const tail_text = tab_count === 1
        ? t('open_all_sample_urls_modal_intro_one_tail')
        : t('open_all_sample_urls_modal_intro_many_tail');
    intro_p.appendChild(create_el('strong', { text_content: strong_text }));
    intro_p.appendChild(document.createTextNode(tail_text));
    message_container.appendChild(intro_p);
    message_container.appendChild(create_el('p', {
        text_content: t('open_all_sample_urls_modal_find_tab_note')
    }));
}

/** Sekund innan tomma flikar redirectar till respektive måladress (modalbekräftelse). */
const NAVIGATE_DELAY_MS = 1000;

function restore_opener_window_focus(focus_element) {
    try { window.focus(); } catch (_) { /* noop */ }
    if (focus_element && document.contains(focus_element)) {
        try { focus_element.focus({ preventScroll: true }); } catch (_) {
            try { focus_element.focus(); } catch (_2) { /* noop */ }
        }
    }
}

function schedule_restore_opener_focus_burst(focus_element) {
    restore_opener_window_focus(focus_element);
    for (const ms of [0, 1, 5, 10, 25, 50, 100, 200, 400]) {
        setTimeout(() => restore_opener_window_focus(focus_element), ms);
    }
}

function blur_and_detach_opened_window(win) {
    if (!win || win.closed) return;
    try { win.blur(); } catch (_) { /* noop */ }
    try { win.opener = null; } catch (_) { /* noop */ }
}

function open_blank_background_tabs(hrefs, focus_element) {
    const windows = [];
    for (let i = 0; i < hrefs.length; i += 1) {
        const w = window.open('about:blank', '_blank');
        windows.push(w || null);
        blur_and_detach_opened_window(w);
        restore_opener_window_focus(focus_element);
    }
    restore_opener_window_focus(focus_element);
    return windows;
}

function redirect_blank_tabs_to_hrefs(hrefs, windows, navigate_delay_ms, focus_element) {
    setTimeout(() => {
        hrefs.forEach((href, index) => {
            const safe = canonical_http_open_href(href);
            const win = windows[index];
            if (!safe || !win || win.closed) return;
            try {
                win.location.href = safe;
                blur_and_detach_opened_window(win);
            } catch (_) { /* noop */ }
        });
        schedule_restore_opener_focus_burst(focus_element);
    }, navigate_delay_ms);
}

function open_http_hrefs_via_blank_then_delayed_assign(hrefs, navigate_delay_ms, focus_element) {
    const windows = open_blank_background_tabs(hrefs, focus_element);
    redirect_blank_tabs_to_hrefs(hrefs, windows, navigate_delay_ms, focus_element);
}

/**
 * Steg 2–3: tomma flikar i bakgrunden, sedan redirect till URL (efter navigate_delay_ms).
 * @param {string[]} hrefs
 * @param {number} [navigate_delay_ms]
 * @param {{ focus_element?: HTMLElement|null }} [opts]
 */
export function open_http_hrefs_via_blank_then_assign(
    hrefs,
    navigate_delay_ms = NAVIGATE_DELAY_MS,
    opts = {}
) {
    if (!hrefs?.length) return;
    open_http_hrefs_via_blank_then_delayed_assign(hrefs, navigate_delay_ms, opts.focus_element ?? null);
}

/** @param {string} href @param {{ focus_element?: HTMLElement|null }} [opts] */
export function open_http_href_in_background_tab(href, opts = {}) {
    const safe = canonical_http_open_href(href);
    if (!safe) return;
    open_http_hrefs_via_blank_then_assign([safe], NAVIGATE_DELAY_MS, opts);
}

/**
 * Fyller modaltext för «Fortsätt där du slutade» med vardaglig förklaring av båda knapparna.
 * @param {HTMLElement} message_container
 * @param {Function} create_el
 * @param {Function} t
 * @param {number} tab_count
 */
export function fill_audit_overview_continue_modal_message(message_container, create_el, t, tab_count) {
    message_container.replaceChildren();
    message_container.appendChild(create_el('p', { text_content: t('audit_overview_continue_modal_lead') }));

    const open_para = create_el('p');
    const open_lead = tab_count === 1
        ? t('audit_overview_continue_modal_open_one_lead')
        : t('audit_overview_continue_modal_open_many_lead', { count: tab_count });
    open_para.appendChild(create_el('strong', { text_content: open_lead }));
    open_para.appendChild(document.createTextNode(t('audit_overview_continue_modal_open_tail')));
    message_container.appendChild(open_para);

    const only_para = create_el('p');
    only_para.appendChild(create_el('strong', {
        text_content: t('audit_overview_continue_modal_only_lead')
    }));
    only_para.appendChild(document.createTextNode(t('audit_overview_continue_modal_only_tail')));
    message_container.appendChild(only_para);

    const stay_para = create_el('p');
    stay_para.appendChild(create_el('strong', {
        text_content: t('audit_overview_continue_modal_stay_lead')
    }));
    stay_para.appendChild(document.createTextNode(t('audit_overview_continue_modal_stay_tail')));
    message_container.appendChild(stay_para);
}

function attach_audit_overview_continue_modal_body(container, modal, ctx) {
    const { create_el, t, focus_target, tab_count, getState, add_protocol, navigate_to_requirement } = ctx;
    const message_block = create_el('div', { class_name: 'modal-message-block' });
    fill_audit_overview_continue_modal_message(message_block, create_el, t, tab_count);
    const placeholder = container.querySelector('p.modal-message');
    if (placeholder) {
        placeholder.replaceWith(message_block);
    } else {
        container.insertBefore(message_block, container.firstChild);
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
        modal.close(focus_target);
        navigate_to_requirement();
        const samples_now = typeof getState === 'function' ? getState().samples : [];
        const { ordered_hrefs } = collect_ordered_sample_open_hrefs(samples_now, add_protocol);
        open_http_hrefs_via_blank_then_assign(ordered_hrefs, NAVIGATE_DELAY_MS, { focus_element: focus_target });
    });
    const only_btn = create_el('button', {
        class_name: ['button', 'button-secondary'],
        text_content: t('audit_overview_continue_requirement_only_button')
    });
    only_btn.addEventListener('click', () => {
        if (confirm_already_handled) return;
        confirm_already_handled = true;
        modal.close(focus_target);
        navigate_to_requirement();
    });
    const stay_btn = create_el('button', {
        class_name: ['button', 'button-secondary'],
        text_content: t('audit_overview_continue_stay_on_overview_button')
    });
    stay_btn.addEventListener('click', () => {
        if (confirm_already_handled) return;
        confirm_already_handled = true;
        modal.close(focus_target);
    });
    buttons_wrapper.append(open_btn, only_btn, stay_btn);
    container.appendChild(buttons_wrapper);
}

/**
 * Modal vid «Fortsätt där du slutade» när granskningsdelar har webbadresser.
 * @param {Object} opts
 * @param {HTMLElement|null} opts.trigger_element
 * @param {() => { samples?: Array<Record<string, unknown>> }} opts.getState
 * @param {Object} opts.Helpers
 * @param {Object} opts.Translation
 * @param {() => void} opts.navigate_to_requirement
 */
export function show_audit_overview_continue_modal({
    trigger_element,
    getState,
    Helpers,
    Translation,
    navigate_to_requirement
}) {
    const ModalComponent = app_runtime_refs.modal_component;
    const t = Translation?.t || (k => k);
    const create_el = Helpers?.create_element;
    const add_protocol = Helpers?.add_protocol_if_missing || HelpersModule.add_protocol_if_missing;

    if (!ModalComponent?.show || !create_el || typeof getState !== 'function') return;
    if (typeof navigate_to_requirement !== 'function') return;

    const samples_initial = getState().samples;
    const { ordered_hrefs } = collect_ordered_sample_open_hrefs(samples_initial, add_protocol);
    if (ordered_hrefs.length === 0) return;

    const focus_target = trigger_element && document.contains(trigger_element) ? trigger_element : null;
    const ctx = {
        create_el,
        t,
        focus_target,
        tab_count: ordered_hrefs.length,
        getState,
        add_protocol,
        navigate_to_requirement
    };

    ModalComponent.show(
        { h1_text: t('audit_overview_continue_modal_title'), message_text: '' },
        (container, modal) => attach_audit_overview_continue_modal_body(container, modal, ctx)
    );
}

function attach_open_all_sample_urls_modal_body(container, modal, ctx) {
    const { create_el, t, focus_target, tab_count, getState, add_protocol } = ctx;
    const message_block = create_el('div', { class_name: 'modal-message-block' });
    fill_open_all_sample_urls_modal_message(message_block, create_el, t, tab_count);
    const placeholder = container.querySelector('p.modal-message');
    if (placeholder) {
        placeholder.replaceWith(message_block);
    } else {
        container.insertBefore(message_block, container.firstChild);
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
        const { ordered_hrefs } = collect_ordered_sample_open_hrefs(samples_now, add_protocol);
        modal.close(focus_target);
        open_http_hrefs_via_blank_then_assign(ordered_hrefs, NAVIGATE_DELAY_MS, { focus_element: focus_target });
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
 * Visar modal och öppnar granskningsdelarnas URL:er vid bekräftelse (färsk state vid klick).
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
    const { ordered_hrefs } = collect_ordered_sample_open_hrefs(samples_initial, add_protocol);
    if (ordered_hrefs.length === 0) return;

    const focus_target = trigger_element && document.contains(trigger_element) ? trigger_element : null;
    const ctx = {
        create_el,
        t,
        focus_target,
        tab_count: ordered_hrefs.length,
        getState,
        add_protocol
    };

    ModalComponent.show(
        { h1_text: t('open_all_sample_urls_modal_title'), message_text: '' },
        (container, modal) => attach_open_all_sample_urls_modal_body(container, modal, ctx)
    );
}
