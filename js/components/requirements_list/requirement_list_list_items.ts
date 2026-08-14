/**
 * DOM-byggande för enskilda rader i kravlistor (alla granskningsdelar respektive en granskningsdel).
 * @module js/components/requirements_list/requirement_list_list_items
 */

import {
    get_stored_requirement_result_for_def,
    get_effective_requirement_audit_status,
    effective_status_is_fully_unreviewed_for_bulk_pass
} from '../../audit_logic.js';
import { get_status_icon } from './requirement_list_status_icons.js';
import { wrap_with_static_tooltip } from '../../utils/generic_tooltip.js';
import { sample_matches_status_filter } from './requirement_list_query.js';
import { sample_has_deficiency_search_for_requirement } from '../../utils/requirement_deficiency_search.js';
import { audit_status_blocks_requirement_navigation } from '../../utils/audit_status_helpers.js';

/**
 * @param {string|number} req_id
 * @param {object} req
 * @param {object[]} samples
 * @param {object} filter_opts
 * @param {Map<string, Set<string>>} relevant_ids_by_sample
 * @param {object|Array|null|undefined} requirements ruleFileContent.requirements
 * @param {() => object} getState
 * @param {object} AuditLogic
 * @param {object} Helpers
 * @param {object} Translation
 * @returns {HTMLElement}
 */
export function create_all_requirement_list_item(
    req_id: any,
    req: any,
    samples: any,
    filter_opts: any,
    relevant_ids_by_sample: any,
    requirements: any,
    getState: any,
    AuditLogic: any,
    Helpers: any,
    Translation: any
) {
    const t = Translation.t;
    const candidates = new Set([String(req_id)]);
    if (req?.key) candidates.add(String(req.key));
    if (req?.id) candidates.add(String(req.id));

    let matching_samples = samples.filter((sample: any) => {
        const sample_set = sample?.id ? relevant_ids_by_sample.get(sample.id) : null;
        if (!sample_set) return false;
        return [...candidates].some(id => sample_set.has(id));
    });

    const {
        status_filters = {},
        has_status_filters = false,
        requirement_needs_help_fn = () => false,
        has_active_filter = false,
        deficiency_search_number = null
    } = filter_opts;
    if (has_status_filters && Object.keys(status_filters).length > 0) {
        matching_samples = matching_samples.filter((sample: any) =>
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

    const req_key = req?.key || req?.id || req_id;
    const requirement_id = req_key;

    const ref_text = req?.standardReference?.text || (typeof req?.reference === 'string' && req.reference.trim() !== '' ? req.reference : '');
    const occurs_text_key = has_active_filter ? 'all_requirements_occurs_in_samples_filtered' : 'all_requirements_occurs_in_samples';
    const sub_lines = [ref_text, t(occurs_text_key, { count: matching_samples.length })].filter(Boolean);

    const li = Helpers.create_element('li', { class_name: 'requirement-item compact-twoline requirement-item-with-actions' });

    const h3 = Helpers.create_element('h3', {
        class_name: 'requirement-header-nested',
        text_content: req?.title || t('unknown_value', { val: req_id })
    });
    li.appendChild(h3);

    if (sub_lines.length > 0) {
        const sub_text = Helpers.create_element('div', {
            class_name: 'requirement-header-sub',
            text_content: sub_lines.join('\n')
        });
        li.appendChild(sub_text);
    }

    const samples_ol = Helpers.create_element('ol', { class_name: 'requirement-samples-list' });

    const audit_status = getState()?.auditStatus;
    const blocks_navigation = audit_status_blocks_requirement_navigation(audit_status);
    const needs_help_fn = filter_opts.requirement_needs_help_fn ?? (AuditLogic?.requirement_needs_help || (() => false));
    for (const sample of matching_samples) {
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
        const sample_li = Helpers.create_element('li', { class_name: 'requirement-sample-item' });
        const status_tooltip_text = t(`audit_status_${base_status}`);
        const icons_wrapper = Helpers.create_element('span', { class_name: 'status-icons-wrapper' });
        const status_icon = Helpers.create_element('span', {
            class_name: `status-icon status-icon-${base_status.replace('_', '-')}`,
            text_content: get_status_icon(base_status),
            attributes: { 'aria-hidden': 'true' }
        });
        icons_wrapper.appendChild(
            wrap_with_static_tooltip(Helpers, status_icon, status_tooltip_text, { use_overlay: true })
        );
        if (needs_help) {
            const warning_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('warning', ['currentColor'], 14) : '';
            const needs_help_icon = Helpers.create_element('span', {
                class_name: 'status-icon status-icon-needs-help-indicator',
                html_content: warning_svg,
                attributes: { 'aria-hidden': 'true' }
            });
            icons_wrapper.appendChild(
                wrap_with_static_tooltip(Helpers, needs_help_icon, t('filter_option_needs_help'), { use_overlay: true })
            );
        }
        if (is_updated) {
            const update_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
            const updated_icon = Helpers.create_element('span', {
                class_name: 'status-icon status-icon-updated-indicator',
                html_content: update_svg,
                attributes: { 'aria-hidden': 'true' }
            });
            icons_wrapper.appendChild(
                wrap_with_static_tooltip(Helpers, updated_icon, t('status_updated_tooltip'), { use_overlay: true })
            );
        }
        const sample_title = blocks_navigation
            ? Helpers.create_element('span', {
                class_name: 'requirement-sample-name',
                text_content: sample_name,
                attributes: { 'aria-label': `${sample_name} – ${status_text}` }
            })
            : Helpers.create_element('a', {
                class_name: 'list-title-link',
                text_content: sample_name,
                attributes: {
                    'data-requirement-id': requirement_id,
                    'data-sample-id': sample?.id || '',
                    href: '#',
                    'aria-label': `${sample_name} – ${status_text}`
                }
            });
        sample_li.appendChild(icons_wrapper);
        sample_li.appendChild(sample_title);
        samples_ol.appendChild(sample_li);
    }

    li.appendChild(samples_ol);

    const all_samples_for_req = samples.filter((sample: any) => {
        const sample_set = sample?.id ? relevant_ids_by_sample.get(sample.id) : null;
        if (!sample_set) return false;
        return [...candidates].some(id => sample_set.has(id));
    });
    const has_unreviewed = all_samples_for_req.some((sample: any) => {
        const req_result = get_stored_requirement_result_for_def(
            sample.requirementResults,
            requirements,
            req,
            req_id
        );
        const status = get_effective_requirement_audit_status(
            requirements,
            sample.requirementResults,
            req,
            req_id
        );
        return effective_status_is_fully_unreviewed_for_bulk_pass(status);
    });

    if (audit_status === 'in_progress' && has_unreviewed) {
        const btn_text = t('mark_requirement_passed_in_all_samples_button');
        const req_title = req?.title || t('unknown_value', { val: req_id });
        const mark_btn = Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'requirement-mark-all-passed-btn'],
            text_content: btn_text,
            attributes: {
                'data-action': 'mark-requirement-passed-all',
                'data-requirement-id': req_key,
                'aria-label': `${btn_text}: ${req_title}`
            }
        });
        li.appendChild(mark_btn);
    }

    return li;
}

/**
 * @param {object} req
 * @param {object} sample
 * @param {object|Array|null|undefined} requirements ruleFileContent.requirements
 * @param {object} AuditLogic
 * @param {object} Helpers
 * @param {object} Translation
 * @returns {HTMLElement}
 */
export function create_requirement_list_item(req: any, sample: any, requirements: any, AuditLogic: any, Helpers: any, Translation: any, getState: any = null) {
    const t = Translation.t;
    const req_result = get_stored_requirement_result_for_def(sample.requirementResults, requirements, req);
    const requirement_needs_help_fn = AuditLogic?.requirement_needs_help || (() => false);
    const base_status = get_effective_requirement_audit_status(
        requirements,
        sample.requirementResults,
        req,
        null
    );
    const needs_help = requirement_needs_help_fn(req_result);
    const is_updated = req_result?.needsReview === true;

    const li = Helpers.create_element('li', { class_name: 'requirement-item compact-twoline' });

    const status_parts = [t(`audit_status_${base_status}`)];
    if (needs_help) status_parts.push(t('filter_option_needs_help'));
    if (is_updated) status_parts.push(t('status_updated_tooltip'));
    const status_label = status_parts.join(', ');
    const aria_label = `${req.title}. ${status_label}`;

    const blocks_navigation = audit_status_blocks_requirement_navigation(getState?.()?.auditStatus);
    const h3 = Helpers.create_element('h3', {
        class_name: blocks_navigation
            ? 'requirement-header-nested'
            : 'requirement-header-nested requirement-title-container',
        ...(blocks_navigation ? { text_content: req.title } : {})
    });
    if (!blocks_navigation) {
        const title_link = Helpers.create_element('a', {
            class_name: 'list-title-link',
            text_content: req.title,
            attributes: {
                'data-requirement-id': req.key,
                'href': '#',
                'aria-label': aria_label
            }
        });
        h3.appendChild(title_link);
    }
    li.appendChild(h3);

    const details_row_div = Helpers.create_element('div', { class_name: 'requirement-details-row' });
    const status_tooltip_text = t(`audit_status_${base_status}`);
    const icons_wrapper = Helpers.create_element('span', { class_name: 'status-icons-wrapper' });
    const status_icon = Helpers.create_element('span', {
        class_name: `status-icon status-icon-${base_status.replace('_', '-')}`,
        text_content: get_status_icon(base_status),
        attributes: { 'aria-hidden': 'true' }
    });
    icons_wrapper.appendChild(
        wrap_with_static_tooltip(Helpers, status_icon, status_tooltip_text, { use_overlay: true })
    );
    if (needs_help) {
        const warning_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('warning', ['currentColor'], 14) : '';
        const needs_help_icon = Helpers.create_element('span', {
            class_name: 'status-icon status-icon-needs-help-indicator',
            html_content: warning_svg,
            attributes: { 'aria-hidden': 'true' }
        });
        icons_wrapper.appendChild(
            wrap_with_static_tooltip(Helpers, needs_help_icon, t('filter_option_needs_help'), { use_overlay: true })
        );
    }
    if (is_updated) {
        const update_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
        const updated_icon = Helpers.create_element('span', {
            class_name: 'status-icon status-icon-updated-indicator',
            html_content: update_svg,
            attributes: { 'aria-hidden': 'true' }
        });
        icons_wrapper.appendChild(
            wrap_with_static_tooltip(Helpers, updated_icon, t('status_updated_tooltip'), { use_overlay: true })
        );
    }

    details_row_div.appendChild(icons_wrapper);

    const total_checks = req.checks?.length || 0;
    const audited_checks = req_result?.checkResults ? Object.values(req_result.checkResults).filter((res: any) => res.status === 'passed' || res.status === 'failed').length : 0;
    details_row_div.appendChild(Helpers.create_element('span', { class_name: 'requirement-checks-info', text_content: `(${audited_checks}/${total_checks} ${t('checks_short')})` }));

    if (req.standardReference?.text) {
        const t_ref = Translation?.t || ((k: string) => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : k));
        const icon_html = Helpers.get_external_link_icon_html ? Helpers.get_external_link_icon_html(t_ref) : ' ↗';
        details_row_div.appendChild(req.standardReference.url
            ? Helpers.create_element('a', { class_name: 'list-reference-link', html_content: (Helpers.escape_html ? Helpers.escape_html(req.standardReference.text) : req.standardReference.text) + icon_html, attributes: { href: req.standardReference.url, target: '_blank', rel: 'noopener noreferrer' } })
            : Helpers.create_element('span', { class_name: 'list-reference-text', text_content: req.standardReference.text })
        );
    }

    li.appendChild(details_row_div);
    return li;
}
