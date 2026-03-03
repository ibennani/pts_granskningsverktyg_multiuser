/**
 * Overlay portal – gemensam container för dropdowns, tooltips m.m. så att de
 * inte klipps av overflow på förfäder. Alla noder som renderas här hamnar
 * direkt under body och påverkas inte av #app-container eller .content-plate.
 */

const OVERLAY_ID = 'app-overlay';

/**
 * Returnerar overlay-containern. Skapar den vid första anrop om den inte finns.
 * @returns {HTMLElement}
 */
export function get_overlay_container() {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
    }
    return el;
}

/**
 * Flyttar en nod in i overlay-containern (appendar den så att den visas ovanpå
 * sidinnehållet och inte klipps). Användaren ansvarar för att antingen
 * anropa remove_from_overlay när noden ska bort, eller ta bort noden manuellt.
 * @param {Node} node - Noden som ska rendera i overlay (t.ex. en panel eller tooltip).
 */
export function render_in_overlay(node) {
    if (!node) return;
    const container = get_overlay_container();
    if (node.parentNode !== container) {
        container.appendChild(node);
    }
}

/**
 * Tar bort en nod från overlay-containern. Noden förstörs inte – användaren
 * kan återanvända den eller append till annan parent.
 * @param {Node} node - Noden som ska tas bort från overlay.
 */
export function remove_from_overlay(node) {
    if (!node || !node.parentNode) return;
    if (node.parentNode.id === OVERLAY_ID) {
        node.parentNode.removeChild(node);
    }
}

const TOOLTIP_WRAPPER_SEL = '.status-icon-tooltip-wrapper';
const TOOLTIP_SEL = '.status-icon-tooltip';
const TOOLTIP_VISIBLE_CLASS = 'status-icon-tooltip--in-overlay';
const TOOLTIP_GAP_PX = 6;

let _current_tooltip_wrapper = null;
let _current_tooltip_el = null;

function _show_tooltip_in_overlay(wrapper) {
    if (!wrapper || !document.body.contains(wrapper)) return;
    const tooltip = wrapper.querySelector(TOOLTIP_SEL);
    if (!tooltip) return;
    _hide_tooltip_from_overlay();
    const container = get_overlay_container();
    container.appendChild(tooltip);
    tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
    const wr = wrapper.getBoundingClientRect();
    tooltip.style.top = `${wr.top - 8}px`;
    tooltip.style.left = `${wr.left + wr.width / 2}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';
    const tr = tooltip.getBoundingClientRect();
    tooltip.style.top = `${wr.top - tr.height - TOOLTIP_GAP_PX}px`;
    _current_tooltip_wrapper = wrapper;
    _current_tooltip_el = tooltip;
}

function _hide_tooltip_from_overlay() {
    if (!_current_tooltip_el || !_current_tooltip_wrapper) return;
    const tooltip = _current_tooltip_el;
    const wrapper = _current_tooltip_wrapper;
    _current_tooltip_wrapper = null;
    _current_tooltip_el = null;
    if (tooltip.classList.contains(TOOLTIP_VISIBLE_CLASS)) {
        tooltip.classList.remove(TOOLTIP_VISIBLE_CLASS);
        tooltip.style.top = '';
        tooltip.style.left = '';
        tooltip.style.transform = '';
        if (tooltip.parentNode && tooltip.parentNode.id === OVERLAY_ID) {
            tooltip.parentNode.removeChild(tooltip);
        }
        if (document.body.contains(wrapper)) {
            wrapper.appendChild(tooltip);
        }
    }
}

function _handle_tooltip_mouseover(e) {
    const wrapper = e.target.closest(TOOLTIP_WRAPPER_SEL);
    if (wrapper) _show_tooltip_in_overlay(wrapper);
}

function _handle_tooltip_mouseout(e) {
    const wrapper = e.target.closest(TOOLTIP_WRAPPER_SEL);
    if (wrapper && (!e.relatedTarget || !wrapper.contains(e.relatedTarget))) {
        _hide_tooltip_from_overlay();
    }
}

function _handle_tooltip_focusin(e) {
    const wrapper = e.target.closest(TOOLTIP_WRAPPER_SEL);
    if (wrapper) _show_tooltip_in_overlay(wrapper);
}

function _handle_tooltip_focusout(e) {
    const wrapper = e.target.closest(TOOLTIP_WRAPPER_SEL);
    if (wrapper && (!e.relatedTarget || !wrapper.contains(e.relatedTarget))) {
        _hide_tooltip_from_overlay();
    }
}

let _tooltip_overlay_setup_done = false;

/**
 * Aktiverar delegerad hantering så att alla .status-icon-tooltip-wrapper
 * visar sin tooltip i overlay (position: fixed) och den inte klipps.
 * Anropas en gång vid app-start (t.ex. från main.js). Idempotent.
 */
export function setup_tooltip_overlay() {
    if (_tooltip_overlay_setup_done) return;
    _tooltip_overlay_setup_done = true;
    document.addEventListener('mouseover', _handle_tooltip_mouseover, true);
    document.addEventListener('mouseout', _handle_tooltip_mouseout, true);
    document.addEventListener('focusin', _handle_tooltip_focusin, true);
    document.addEventListener('focusout', _handle_tooltip_focusout, true);
}
