// js/logic/autosave_service.js

import { trim_textarea_preserve_lines } from '../utils/helpers.js';

const DEFAULT_DEBOUNCE_MS = 250;
const RESTORE_DELAY_MS = 50;

function safe_css_escape(value) {
    if (typeof value !== 'string') return '';
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }
    return value.replace(/["\\]/g, '\\$&');
}

function capture_focus_state(focus_root) {
    if (!focus_root) return null;
    const active_element = document.activeElement;
    if (!active_element || !focus_root.contains(active_element)) return null;

    const tag = active_element.tagName ? active_element.tagName.toLowerCase() : '';
    const has_value = tag === 'input' || tag === 'textarea';
    const captured_value = has_value && active_element.value !== undefined ? active_element.value : null;

    return {
        element_id: active_element.id || null,
        element_name: active_element.name || null,
        data_index: active_element.getAttribute('data-index') || null,
        selection_start: typeof active_element.selectionStart === 'number' ? active_element.selectionStart : null,
        selection_end: typeof active_element.selectionEnd === 'number' ? active_element.selectionEnd : null,
        scroll_top: typeof active_element.scrollTop === 'number' ? active_element.scrollTop : null,
        scroll_left: typeof active_element.scrollLeft === 'number' ? active_element.scrollLeft : null,
        captured_value
    };
}

function restore_focus_state({ focus_root, focus_state, window_scroll }) {
    if (!focus_root || !focus_state) return;

    let element_to_focus = null;
    if (focus_state.element_id) {
        element_to_focus = focus_root.querySelector(`#${safe_css_escape(focus_state.element_id)}`);
    }
    if (!element_to_focus && focus_state.element_name) {
        element_to_focus = focus_root.querySelector(`[name="${safe_css_escape(focus_state.element_name)}"]`);
    }
    if (!element_to_focus && focus_state.data_index !== null) {
        const candidates = focus_root.querySelectorAll(`[data-index="${safe_css_escape(focus_state.data_index)}"]`);
        if (candidates.length > 0) {
            element_to_focus = candidates[0];
        }
    }

    if (window_scroll) {
        window.scrollTo({ left: window_scroll.x, top: window_scroll.y, behavior: 'instant' });
    }

    if (!element_to_focus || !document.contains(element_to_focus)) return;

    if (focus_state.scroll_top !== null && typeof element_to_focus.scrollTop === 'number') {
        element_to_focus.scrollTop = focus_state.scroll_top;
    }
    if (focus_state.scroll_left !== null && typeof element_to_focus.scrollLeft === 'number') {
        element_to_focus.scrollLeft = focus_state.scroll_left;
    }

    try {
        element_to_focus.focus({ preventScroll: true });
    } catch (e) {
        element_to_focus.focus();
    }

    // Återställ markör endast om innehållet inte har ändrats sedan capture.
    // Om användaren skrivit under RESTORE_DELAY_MS skulle setSelectionRange flytta
    // cursorn tillbaka och få bokstäver att hamna i fel ordning.
    const value_unchanged = focus_state.captured_value === null ||
        (element_to_focus.value !== undefined && element_to_focus.value === focus_state.captured_value);

    if (value_unchanged && focus_state.selection_start !== null && focus_state.selection_end !== null && element_to_focus.setSelectionRange) {
        try {
            element_to_focus.setSelectionRange(focus_state.selection_start, focus_state.selection_end);
        } catch (e) {
            // Ignorera om setSelectionRange inte fungerar
        }
    }
}

export const AutosaveService = {
    trim_text_preserve_lines: trim_textarea_preserve_lines,

    sanitize_text(value, { should_trim = false } = {}) {
        if (typeof value !== 'string') return '';
        const without_scripts = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        return should_trim ? this.trim_text_preserve_lines(without_scripts) : without_scripts;
    },

    create_session({ form_element, focus_root, on_save, debounce_ms = DEFAULT_DEBOUNCE_MS } = {}) {
        const session = {
            form_element,
            focus_root: focus_root || form_element,
            on_save,
            debounce_ms,
            timer: null,
            destroyed: false,
            request_autosave: null,
            flush: null,
            cancel_pending: null,
            set_form_element: null,
            destroy: null
        };

        const perform_save = ({ is_autosave, should_trim, skip_render, restore_focus }) => {
            if (session.destroyed || typeof session.on_save !== 'function') return;
            const focus_state = restore_focus ? capture_focus_state(session.focus_root) : null;
            const window_scroll = restore_focus ? { x: window.scrollX, y: window.scrollY } : null;

            session.on_save({
                is_autosave,
                should_trim,
                skip_render,
                trim_text: this.trim_text_preserve_lines.bind(this),
                sanitize_text: this.sanitize_text.bind(this)
            });

            if (!restore_focus) return;
            setTimeout(() => {
                requestAnimationFrame(() => {
                    restore_focus_state({
                        focus_root: session.focus_root,
                        focus_state,
                        window_scroll
                    });
                });
            }, RESTORE_DELAY_MS);
        };

        session.request_autosave = () => {
            if (session.destroyed) return;
            clearTimeout(session.timer);
            session.timer = setTimeout(() => {
                perform_save({
                    is_autosave: true,
                    should_trim: false,
                    skip_render: true,
                    restore_focus: true
                });
            }, session.debounce_ms);
        };

        session.flush = ({ should_trim = false, skip_render = false } = {}) => {
            if (session.destroyed) return;
            clearTimeout(session.timer);
            session.timer = null;
            perform_save({
                is_autosave: false,
                should_trim,
                skip_render,
                restore_focus: false
            });
        };

        session.cancel_pending = () => {
            clearTimeout(session.timer);
            session.timer = null;
        };

        session.set_form_element = (new_form_element) => {
            session.form_element = new_form_element;
            session.focus_root = new_form_element;
        };

        session.destroy = () => {
            session.cancel_pending();
            session.destroyed = true;
            session.form_element = null;
            session.focus_root = null;
            session.on_save = null;
        };

        return session;
    }
};
