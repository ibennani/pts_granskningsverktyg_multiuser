/**
 * Fingeravtryck och partiell DOM-uppdatering för kravlistor.
 * @module js/components/requirements_list/requirement_list_incremental_dom
 */

import { create_status_icons_wrapper } from './requirement_list_status_icons.js';
import { sample_matches_status_filter } from './requirement_list_query.js';

/**
 * @param {string} mode
 * @param {Array} sorted_items
 * @param {object[]} samples
 * @param {Map<string, Set<string>>|null|undefined} relevant_ids_by_sample
 * @param {object} filter_opts
 * @param {object} AuditLogic
 * @returns {string[]}
 */
export function build_item_keys(mode, sorted_items, samples, relevant_ids_by_sample, filter_opts = {}, AuditLogic) {
    if (mode === 'sample') {
        return sorted_items.map(req => req?.key || req?.id || '');
    }
    const keys = [];
    const { status_filters = {}, has_status_filters = false, requirement_needs_help_fn = () => false } = filter_opts;
    const candidates = (req_id, req) => new Set([String(req_id), ...(req?.key ? [String(req.key)] : []), ...(req?.id ? [String(req.id)] : [])]);

    sorted_items.forEach(([req_id, req]) => {
        const req_key = req?.key || req?.id || req_id;
        let matching = samples.filter(sample => {
            const sample_set = sample?.id ? relevant_ids_by_sample?.get(sample.id) : null;
            if (!sample_set) return false;
            return [...candidates(req_id, req)].some(id => sample_set.has(id));
        });
        if (has_status_filters && Object.keys(status_filters).length > 0) {
            matching = matching.filter(sample =>
                sample_matches_status_filter(sample, req_id, req, status_filters, has_status_filters, requirement_needs_help_fn, AuditLogic)
            );
        }
        matching.forEach(s => keys.push(`${req_key}:${s?.id || ''}`));
    });
    return keys;
}

/**
 * @param {string} mode
 * @param {HTMLElement|null|undefined} content_div_for_delegation
 * @param {Map<string, Set<string>>|null|undefined} relevant_ids_by_sample
 * @param {Array} sorted_items
 * @param {object[]} samples
 * @param {object|null|undefined} current_sample_object
 * @param {object} filter_opts
 * @param {object} AuditLogic
 * @param {{ Helpers: object, Translation: object }} icons_ctx
 */
export function update_items_status_only(
    mode,
    content_div_for_delegation,
    relevant_ids_by_sample,
    sorted_items,
    samples,
    current_sample_object,
    filter_opts,
    AuditLogic,
    icons_ctx
) {
    const t = icons_ctx.Translation.t;
    const needs_help_fn = filter_opts.requirement_needs_help_fn ?? (AuditLogic?.requirement_needs_help || (() => false));

    if (mode === 'sample') {
        const items = content_div_for_delegation?.querySelectorAll?.('ol.requirement-items-ul > li.requirement-item');
        if (!items || items.length !== sorted_items.length) return;
        sorted_items.forEach((req, i) => {
            const li = items[i];
            if (!li) return;
            const req_result = (current_sample_object.requirementResults || {})[req.key];
            const base_status = AuditLogic.calculate_requirement_status(req, req_result);
            const needs_help = needs_help_fn(req_result);
            const is_updated = req_result?.needsReview === true;
            const status_parts = [t(`audit_status_${base_status}`)];
            if (needs_help) status_parts.push(t('filter_option_needs_help'));
            if (is_updated) status_parts.push(t('status_updated_tooltip'));
            const status_label = status_parts.join(', ');
            const aria_label = `${req.title}. ${status_label}`;

            const link = li.querySelector('a.list-title-link');
            const details_row = li.querySelector('.requirement-details-row');
            if (link) link.setAttribute('aria-label', aria_label);
            if (details_row) {
                const old_icons = details_row.querySelector('.status-icons-wrapper');
                const new_icons = create_status_icons_wrapper(icons_ctx, base_status, needs_help, is_updated);
                if (old_icons && new_icons) old_icons.replaceWith(new_icons);
                const checks_span = details_row.querySelector('.requirement-checks-info');
                if (checks_span) {
                    const total_checks = req.checks?.length || 0;
                    const audited_checks = req_result?.checkResults ? Object.values(req_result.checkResults).filter(res => res.status === 'passed' || res.status === 'failed').length : 0;
                    checks_span.textContent = `(${audited_checks}/${total_checks} ${t('checks_short')})`;
                }
            }
        });
    } else {
        const req_lis = content_div_for_delegation?.querySelectorAll?.('ul.requirement-items-ul > li.requirement-item-with-actions');
        if (!req_lis || req_lis.length !== sorted_items.length) return;
        sorted_items.forEach(([req_id, req], ri) => {
            const req_li = req_lis[ri];
            if (!req_li) return;
            const req_key = req?.key || req?.id || req_id;
            const cand = new Set([String(req_id), ...(req?.key ? [String(req.key)] : []), ...(req?.id ? [String(req.id)] : [])]);
            let matching_samples = samples.filter(sample => {
                const sample_set = sample?.id ? relevant_ids_by_sample?.get(sample.id) : null;
                if (!sample_set) return false;
                return [...cand].some(id => sample_set.has(id));
            });
            if (filter_opts.has_status_filters && Object.keys(filter_opts.status_filters || {}).length > 0) {
                matching_samples = matching_samples.filter(sample =>
                    sample_matches_status_filter(sample, req_id, req, filter_opts.status_filters, filter_opts.has_status_filters, needs_help_fn, AuditLogic)
                );
            }
            const sample_lis = req_li.querySelectorAll('ol.requirement-samples-list > li.requirement-sample-item');
            matching_samples.forEach((sample, si) => {
                const sample_li = sample_lis[si];
                if (!sample_li) return;
                const req_result = (sample.requirementResults || {})[req_key];
                const base_status = AuditLogic.calculate_requirement_status(req, req_result);
                const needs_help = needs_help_fn(req_result);
                const is_updated = req_result?.needsReview === true;
                const status_text = t(`audit_status_${base_status}`) +
                    (needs_help ? ` (${t('filter_option_needs_help')})` : '') +
                    (is_updated ? ` (${t('status_updated_tooltip')})` : '');
                const sample_name = sample?.description || t('undefined_description');

                const link = sample_li.querySelector('a.list-title-link');
                const old_icons = sample_li.querySelector('.status-icons-wrapper');
                const new_icons = create_status_icons_wrapper(icons_ctx, base_status, needs_help, is_updated);
                if (link) link.setAttribute('aria-label', `${sample_name} – ${status_text}`);
                if (old_icons && new_icons) old_icons.replaceWith(new_icons);
            });
        });
    }
}
