/**
 * Fingeravtryck och partiell DOM-uppdatering för kravlistor.
 * @module js/components/requirements_list/requirement_list_incremental_dom
 */

import { get_stored_requirement_result_for_def, get_effective_requirement_audit_status, effective_status_is_fully_unreviewed_for_bulk_pass } from '../../audit_logic.js';
import { create_status_icons_wrapper } from './requirement_list_status_icons.js';
import { sample_matches_status_filter } from './requirement_list_query.js';
import { sample_has_deficiency_search_for_requirement } from '../../utils/requirement_deficiency_search.js';

/**
 * @param {string} mode
 * @param {Array} sorted_items
 * @param {object[]} samples
 * @param {Map<string, Set<string>>|null|undefined} relevant_ids_by_sample
 * @param {object} filter_opts
 * @param {object} AuditLogic
 * @param {object|Array|null|undefined} requirements ruleFileContent.requirements
 * @returns {string[]}
 */
export function build_item_keys(
    mode: any,
    sorted_items: any,
    samples: any,
    relevant_ids_by_sample: any,
    filter_opts: any = {},
    AuditLogic: any,
    requirements: any
) {
    if (mode === 'sample') {
        return sorted_items.map((req: any) => req?.key || req?.id || '');
    }
    const keys: string[] = [];
    const {
        status_filters = {},
        has_status_filters = false,
        requirement_needs_help_fn = () => false,
        deficiency_search_number = null
    } = filter_opts;
    const candidates = (req_id: any, req: any) => new Set([String(req_id), ...(req?.key ? [String(req.key)] : []), ...(req?.id ? [String(req.id)] : [])]);

    sorted_items.forEach(([req_id, req]: [any, any]) => {
        const req_key = req?.key || req?.id || req_id;
        let matching = samples.filter((sample: any) => {
            const sample_set = sample?.id ? relevant_ids_by_sample?.get(sample.id) : null;
            if (!sample_set) return false;
            return [...candidates(req_id, req)].some(id => sample_set.has(id));
        });
        if (has_status_filters && Object.keys(status_filters).length > 0) {
            matching = matching.filter((sample: any) =>
                sample_matches_status_filter(
                    sample,
                    req_id,
                    req,
                    status_filters,
                    has_status_filters,
                    requirement_needs_help_fn,
                    AuditLogic,
                    requirements
                )
            );
        }
        if (deficiency_search_number !== null && deficiency_search_number !== undefined) {
            matching = matching.filter((sample: any) =>
                sample_has_deficiency_search_for_requirement(
                    sample,
                    req_id,
                    req,
                    requirements,
                    deficiency_search_number
                )
            );
        }
        matching.forEach((s: any) => keys.push(`${req_key}:${s?.id || ''}`));
    });
    return keys;
}

/**
 * Visar eller döljer knappen "Markera som godkänt i alla stickprov" efter bulk-åtgärd.
 */
export function sync_requirement_mark_all_passed_button(
    req_li: HTMLElement,
    req_id: string,
    req: Record<string, unknown>,
    samples: Record<string, unknown>[],
    relevant_ids_by_sample: Map<string, Set<string>> | null | undefined,
    requirements: unknown,
    audit_status: string | undefined,
    icons_ctx: { Helpers: { create_element: (...args: unknown[]) => HTMLElement }; Translation: { t: (key: string, params?: Record<string, unknown>) => string } }
) {
    const t = icons_ctx.Translation.t;
    const Helpers = icons_ctx.Helpers;
    const candidates = new Set([String(req_id)]);
    if (req?.key) candidates.add(String(req.key));
    if (req?.id) candidates.add(String(req.id));

    const all_samples_for_req = samples.filter((sample) => {
        const sample_set = sample?.id ? relevant_ids_by_sample?.get(String(sample.id)) : null;
        if (!sample_set) return false;
        return [...candidates].some((id) => sample_set.has(id));
    });

    const has_unreviewed = all_samples_for_req.some((sample) => {
        const status = get_effective_requirement_audit_status(
            requirements,
            sample.requirementResults as Record<string, unknown> | undefined,
            req,
            req_id
        );
        return effective_status_is_fully_unreviewed_for_bulk_pass(status);
    });

    const existing_btn = req_li.querySelector('button[data-action="mark-requirement-passed-all"]');
    const req_key = String(req?.key || req?.id || req_id);

    if (audit_status === 'in_progress' && has_unreviewed) {
        if (!existing_btn) {
            const btn_text = t('mark_requirement_passed_in_all_samples_button');
            const req_title = String(req?.title || t('unknown_value', { val: req_id }));
            const mark_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'requirement-mark-all-passed-btn'],
                text_content: btn_text,
                attributes: {
                    'data-action': 'mark-requirement-passed-all',
                    'data-requirement-id': req_key,
                    'aria-label': `${btn_text}: ${req_title}`
                }
            });
            req_li.appendChild(mark_btn);
        }
    } else if (existing_btn) {
        existing_btn.remove();
    }
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
 * @param {{ Helpers: object, Translation: object, requirements?: object|Array|null, getState?: () => object }} icons_ctx
 */
export function update_items_status_only(
    mode: any,
    content_div_for_delegation: any,
    relevant_ids_by_sample: any,
    sorted_items: any,
    samples: any,
    current_sample_object: any,
    filter_opts: any,
    AuditLogic: any,
    icons_ctx: any
) {
    const t = icons_ctx.Translation.t;
    const needs_help_fn = filter_opts.requirement_needs_help_fn ?? (AuditLogic?.requirement_needs_help || (() => false));
    const requirements = icons_ctx.requirements;

    if (mode === 'sample') {
        const items = content_div_for_delegation?.querySelectorAll?.('ol.requirement-items-ul > li.requirement-item');
        if (!items || items.length !== sorted_items.length) return;
        sorted_items.forEach((req: any, i: any) => {
            const li = items[i];
            if (!li) return;
            const req_result = get_stored_requirement_result_for_def(
                current_sample_object?.requirementResults,
                requirements,
                req
            );
            const base_status = get_effective_requirement_audit_status(
                requirements,
                current_sample_object?.requirementResults,
                req,
                null
            );
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
        sorted_items.forEach(([req_id, req]: [any, any], ri: any) => {
            const req_li = req_lis[ri];
            if (!req_li) return;
            const req_key = req?.key || req?.id || req_id;
            const cand = new Set([String(req_id), ...(req?.key ? [String(req.key)] : []), ...(req?.id ? [String(req.id)] : [])]);
            let matching_samples = samples.filter((sample: any) => {
                const sample_set = sample?.id ? relevant_ids_by_sample?.get(sample.id) : null;
                if (!sample_set) return false;
                return [...cand].some(id => sample_set.has(id));
            });
            if (filter_opts.has_status_filters && Object.keys(filter_opts.status_filters || {}).length > 0) {
                matching_samples = matching_samples.filter((sample: any) =>
                    sample_matches_status_filter(
                        sample,
                        req_id,
                        req,
                        filter_opts.status_filters,
                        filter_opts.has_status_filters,
                        needs_help_fn,
                        AuditLogic,
                        requirements
                    )
                );
            }
            const deficiency_search_number = filter_opts.deficiency_search_number;
            if (deficiency_search_number !== null && deficiency_search_number !== undefined) {
                matching_samples = matching_samples.filter((sample: any) =>
                    sample_has_deficiency_search_for_requirement(
                        sample,
                        req_id,
                        req,
                        requirements,
                        deficiency_search_number
                    )
                );
            }
            const sample_lis = req_li.querySelectorAll('ol.requirement-samples-list > li.requirement-sample-item');
            matching_samples.forEach((sample: any, si: any) => {
                const sample_li = sample_lis[si];
                if (!sample_li) return;
                const req_result = get_stored_requirement_result_for_def(
                    sample.requirementResults,
                    requirements,
                    req,
                    req_id
                );
                const base_status = get_effective_requirement_audit_status(
                    requirements,
                    sample.requirementResults,
                    req,
                    req_id
                );
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
            sync_requirement_mark_all_passed_button(
                req_li,
                req_id,
                req,
                samples,
                relevant_ids_by_sample,
                requirements,
                icons_ctx.getState?.()?.auditStatus,
                icons_ctx
            );
        });
    }
}
