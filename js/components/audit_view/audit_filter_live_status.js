/**
 * @fileoverview Dold role=status-bekräftelse när filter i granskningslistan ändras.
 */

const CLEAR_AFTER_MS = 800;
const NO_RESULTS_DEBOUNCE_MS = 400;

/** @type {ReturnType<typeof setTimeout> | null} */
let no_results_timer = null;

/**
 * Meddelar skärmläsare att filtret återställts (visuellt dolt).
 * @param {HTMLElement | null | undefined} live_region
 * @param {string} message
 */
export function announce_audit_filter_reset(live_region, message) {
    if (!live_region) return;
    live_region.textContent = message;
    setTimeout(() => {
        live_region.textContent = '';
    }, CLEAR_AFTER_MS);
}

/**
 * Meddelar skärmläsare om aktuellt filterläge (visuellt dolt).
 * @param {HTMLElement | null | undefined} live_region
 * @param {string} message
 */
export function announce_audit_filter_status(live_region, message) {
    if (!live_region || !message) return;
    live_region.textContent = message;
    setTimeout(() => {
        live_region.textContent = '';
    }, CLEAR_AFTER_MS);
}

/**
 * Debounced meddelande när sök/filter ger noll träffar.
 * @param {HTMLElement | null | undefined} live_region
 * @param {boolean} should_announce
 * @param {string} message
 */
export function schedule_audit_filter_no_results_announcement(live_region, should_announce, message) {
    if (no_results_timer) {
        clearTimeout(no_results_timer);
        no_results_timer = null;
    }
    if (!live_region || !should_announce || !message) return;
    no_results_timer = setTimeout(() => {
        no_results_timer = null;
        announce_audit_filter_status(live_region, message);
    }, NO_RESULTS_DEBOUNCE_MS);
}

/**
 * Bygger filter-etiketter för live-region (sekundära filter).
 * @param {object} ctx AuditViewComponent-kontext
 * @param {(key: string) => string} t
 * @returns {string[]}
 */
export function build_secondary_filter_live_labels(ctx, t) {
    const labels = [];
    if (String(ctx.granskningstyp_filter || '').trim() && ctx._granskningstypSelectRef) {
        const opt = ctx._granskningstypSelectRef.selectedOptions?.[0];
        if (opt?.textContent) labels.push(opt.textContent.trim());
    }
    if (String(ctx.audit_type_filter || '').trim() && ctx._auditTypeSelectRef) {
        const opt = ctx._auditTypeSelectRef.selectedOptions?.[0];
        if (opt?.textContent) labels.push(opt.textContent.trim());
    }
    const group_mode = String(ctx.audit_list_group_mode || 'all');
    if (group_mode !== 'all' && ctx._auditGroupByCaseSelectRef) {
        const opt = ctx._auditGroupByCaseSelectRef.selectedOptions?.[0];
        if (opt?.textContent) labels.push(opt.textContent.trim());
    }
    const page_size = String(ctx.audit_table_page_size || 'all');
    if (page_size !== 'all' && ctx._auditPageSizeSelectRef) {
        const opt = ctx._auditPageSizeSelectRef.selectedOptions?.[0];
        if (opt?.textContent) labels.push(opt.textContent.trim());
    }
    return labels;
}
