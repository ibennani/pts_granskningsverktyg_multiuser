/**
 * Fokushantering: sparar och återställer fokus per vy/omfång (sessionStorage, restore position).
 * @module js/logic/focus_manager
 */

import { memoryManager } from '../utils/memory_manager.js';

const FOCUS_STORAGE_KEY = 'gv_focus_by_scope_v1';

let restore_position_state = { view: null, params: {}, focusInfo: null };

if (typeof window !== 'undefined') {
    window.__gv_get_restore_position = () => restore_position_state;
}

export function load_focus_storage() {
    try {
        const raw = window.sessionStorage?.getItem(FOCUS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch (e) {
        return {};
    }
}

export function save_focus_storage(storage) {
    try {
        window.sessionStorage?.setItem(FOCUS_STORAGE_KEY, JSON.stringify(storage || {}));
    } catch (e) {
        /* ignore */
    }
}

export function capture_focus_info_from_element(el, main_view_root) {
    if (!el || !main_view_root || !main_view_root.contains(el)) return null;
    const id = el.id;
    const name = el.getAttribute?.('name');
    const data_index = el.getAttribute?.('data-index');
    if (id) return { elementId: id, elementName: null, dataIndex: null };
    if (name !== null && name !== undefined) return { elementId: null, elementName: name, dataIndex: data_index };

    const row = el.closest && el.closest('tr[data-row-id]');
    if (row && row.parentElement && row.parentElement.tagName === 'TBODY') {
        const row_id = row.getAttribute('data-row-id');
        if (row_id) {
            const cells = Array.from(row.cells || []);
            let col_index = -1;
            const owning_cell = el.closest('td');
            if (owning_cell) {
                col_index = cells.indexOf(owning_cell);
            }
            if (col_index >= 0) {
                return {
                    tableRowId: String(row_id),
                    tableColIndex: col_index
                };
            }
        }
    }

    const requirement_id = el.getAttribute?.('data-requirement-id');
    const sample_id = el.getAttribute?.('data-sample-id');
    if (requirement_id && sample_id) {
        return {
            requirementId: requirement_id,
            sampleId: sample_id
        };
    }

    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'a') {
        const href = el.getAttribute && el.getAttribute('href');
        if (href) {
            const selector = `a[href="${CSS.escape(href)}"]`;
            const all_links = Array.from(main_view_root.querySelectorAll(selector));
            const link_index = all_links.indexOf(el);
            return {
                linkHref: href,
                linkIndex: link_index >= 0 ? link_index : null
            };
        }
    }

    if (tag === 'button') {
        const label = (el.textContent || '').trim();
        if (label) {
            const all_buttons = Array
                .from(main_view_root.querySelectorAll('button'))
                .filter((btn) => (btn.textContent || '').trim() === label);
            const button_index = all_buttons.indexOf(el);
            return {
                buttonTag: 'button',
                buttonLabel: label,
                buttonIndex: button_index >= 0 ? button_index : null
            };
        }
    }

    return null;
}

export function update_restore_position(view, params, focus_info) {
    restore_position_state = {
        view: view,
        params: params || {},
        focusInfo: focus_info ?? restore_position_state.focusInfo
    };
}

export function apply_restore_focus_instruction({ view_root }) {
    if (!view_root) return false;
    const focus_info = window.__gv_restore_focus_info;
    if (!focus_info) return false;
    window.__gv_restore_focus_info = null;
    window.customFocusApplied = true;

    const try_focus = (attempts_left) => {
        let el = null;

        if (focus_info.elementId) {
            el = view_root.querySelector(`#${CSS.escape(focus_info.elementId)}`);
        }
        if (!el && focus_info.elementName) {
            el = view_root.querySelector(`[name="${CSS.escape(focus_info.elementName)}"]`);
            if (!el && focus_info.dataIndex !== null && focus_info.dataIndex !== undefined) {
                const candidates = view_root.querySelectorAll(`[name="${CSS.escape(focus_info.elementName)}"]`);
                const idx = parseInt(focus_info.dataIndex, 10);
                if (!Number.isNaN(idx) && candidates[idx]) el = candidates[idx];
            }
        }

        if (!el && focus_info.tableRowId && typeof focus_info.tableColIndex === 'number') {
            const tbody_rows = view_root.querySelectorAll('tbody tr[data-row-id]');
            let target_row = null;
            for (const r of tbody_rows) {
                if (r.getAttribute('data-row-id') === String(focus_info.tableRowId)) {
                    target_row = r;
                    break;
                }
            }
            if (target_row && target_row.cells && target_row.cells.length > focus_info.tableColIndex) {
                const cell = target_row.cells[focus_info.tableColIndex];
                if (cell) {
                    el = cell.querySelector('a[href], button, [tabindex="0"]');
                }
            }
        }

        if (!el && focus_info.requirementId) {
            let selector = `[data-requirement-id="${CSS.escape(focus_info.requirementId)}"]`;
            if (focus_info.sampleId) {
                selector += `[data-sample-id="${CSS.escape(focus_info.sampleId)}"]`;
            }
            const candidates = view_root.querySelectorAll(selector);
            if (candidates && candidates.length > 0) {
                el = candidates[0];
            }
        }

        if (!el && focus_info.linkHref) {
            const selector = `a[href="${CSS.escape(focus_info.linkHref)}"]`;
            const candidates = Array.from(view_root.querySelectorAll(selector));
            if (candidates.length > 0) {
                const idx = typeof focus_info.linkIndex === 'number' ? focus_info.linkIndex : 0;
                el = candidates[idx] || candidates[0];
            }
        }

        if (!el && focus_info.buttonTag === 'button' && focus_info.buttonLabel) {
            const all_buttons = Array
                .from(view_root.querySelectorAll('button'))
                .filter((btn) => (btn.textContent || '').trim() === focus_info.buttonLabel);
            if (all_buttons.length > 0) {
                const idx = typeof focus_info.buttonIndex === 'number' ? focus_info.buttonIndex : 0;
                el = all_buttons[idx] || all_buttons[0];
            }
        }

        if (el && document.contains(el)) {
            try {
                el.focus({ preventScroll: false });
                el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            } catch (e) {
                el.focus();
            }
            return;
        }
        if (attempts_left > 0) {
            memoryManager.setTimeout(() => try_focus(attempts_left - 1), 100);
        }
    };
    memoryManager.setTimeout(() => try_focus(40), 200);
    return true;
}

export function apply_post_render_focus_instruction({ view_name, view_root }) {
    if (view_root && apply_restore_focus_instruction({ view_root })) return true;

    if (!view_root || !window.sessionStorage) return false;

    const RETURN_FOCUS_AUDIT_INFO_H2_KEY = 'gv_return_focus_audit_info_h2_v1';

    if (view_name !== 'audit_overview') return false;

    let raw = null;
    try {
        raw = window.sessionStorage.getItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY);
    } catch (e) {
        return false;
    }
    if (!raw) return false;

    let instruction = null;
    try {
        instruction = JSON.parse(raw);
    } catch (e) {
        try {
            window.sessionStorage.removeItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY);
        } catch (_) {
            // ignoreras medvetet
        }
        return false;
    }

    if (instruction?.focus !== 'audit_info_h2') {
        try {
            window.sessionStorage.removeItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY);
        } catch (_) {
            // ignoreras medvetet
        }
        return false;
    }

    window.customFocusApplied = true;

    let attempts_left = 6;
    const try_focus = () => {
        const heading = view_root.querySelector('#audit-info-heading');
        if (heading) {
            const top_action_bar = document.getElementById('global-action-bar-top');
            const top_bar_height = top_action_bar ? top_action_bar.offsetHeight : 0;

            const rect = heading.getBoundingClientRect();
            const absolute_top = rect.top + window.pageYOffset;
            const scroll_target = Math.max(0, absolute_top - top_bar_height);

            window.scrollTo({ top: scroll_target, behavior: 'auto' });

            try {
                if (heading.getAttribute('tabindex') === null) {
                    heading.setAttribute('tabindex', '-1');
                }
                heading.focus({ preventScroll: true });
            } catch (e) {
                heading.focus();
            }
            try {
                window.sessionStorage.removeItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY);
            } catch (_) {
                // ignoreras medvetet
            }
            return;
        }

        attempts_left -= 1;
        if (attempts_left <= 0) {
            try {
                window.sessionStorage.removeItem(RETURN_FOCUS_AUDIT_INFO_H2_KEY);
            } catch (_) {
                // ignoreras medvetet
            }
            return;
        }

        memoryManager.setTimeout(try_focus, 50);
    };

    memoryManager.setTimeout(try_focus, 0);
    return true;
}
