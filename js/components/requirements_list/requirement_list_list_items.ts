// @ts-nocheck
/**
 * DOM-byggande för enskilda rader i kravlistor (alla stickprov respektive ett stickprov).
 * @module js/components/requirements_list/requirement_list_list_items
 */

import { get_stored_requirement_result_for_def, get_effective_requirement_audit_status } from '../../audit_logic.js';
import { get_status_icon } from './requirement_list_status_icons.js';
import { sample_matches_status_filter } from './requirement_list_query.js';

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
    req_id,
    req,
    samples,
    filter_opts,
    relevant_ids_by_sample,
    requirements,
    getState,
    AuditLogic,
    Helpers,
    Translation
) {
    const t = Translation.t;
    const candidates = new Set([String(req_id)]);
    if (req?.key) candidates.add(String(req.key));
    if (req?.id) candidates.add(String(req.id));

    let matching_samples = samples.filter(sample => {
        const sample_set = sample?.id ? relevant_ids_by_sample.get(sample.id) : null;
        if (!sample_set) return false;
        return [...candidates].some(id => sample_set.has(id));
    });

    const { status_filters = {}, has_status_filters = false, requirement_needs_help_fn = () => false, has_active_filter = false } = filter_opts;
    if (has_status_filters && Object.keys(status_filters).length > 0) {
        matching_samples = matching_samples.filter(sample =>
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
        const status_icon_wrapper = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
        const status_icon = Helpers.create_element('span', {
            class_name: `status-icon status-icon-${base_status.replace('_', '-')}`,
            text_content: get_status_icon(base_status),
            attributes: { 'aria-hidden': 'true' }
        });
        const status_tooltip = Helpers.create_element('span', {
            class_name: 'status-icon-tooltip',
            text_content: status_tooltip_text,
            attributes: { 'aria-hidden': 'true' }
        });
        status_icon_wrapper.appendChild(status_icon);
        status_icon_wrapper.appendChild(status_tooltip);
        icons_wrapper.appendChild(status_icon_wrapper);
        if (needs_help) {
            const warning_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('warning', ['currentColor'], 14) : '';
            const needs_help_wrapper = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
            const needs_help_icon = Helpers.create_element('span', {
                class_name: 'status-icon status-icon-needs-help-indicator',
                html_content: warning_svg,
                attributes: { 'aria-hidden': 'true' }
            });
            const needs_help_tooltip = Helpers.create_element('span', {
                class_name: 'status-icon-tooltip',
                text_content: t('filter_option_needs_help'),
                attributes: { 'aria-hidden': 'true' }
            });
            needs_help_wrapper.appendChild(needs_help_icon);
            needs_help_wrapper.appendChild(needs_help_tooltip);
            icons_wrapper.appendChild(needs_help_wrapper);
        }
        if (is_updated) {
            const update_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
            const updated_wrapper = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
            const updated_icon = Helpers.create_element('span', {
                class_name: 'status-icon status-icon-updated-indicator',
                html_content: update_svg,
                attributes: { 'aria-hidden': 'true' }
            });
            const updated_tooltip = Helpers.create_element('span', {
                class_name: 'status-icon-tooltip',
                text_content: t('status_updated_tooltip'),
                attributes: { 'aria-hidden': 'true' }
            });
            updated_wrapper.appendChild(updated_icon);
            updated_wrapper.appendChild(updated_tooltip);
            icons_wrapper.appendChild(updated_wrapper);
        }
        const sample_link = Helpers.create_element('a', {
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
        sample_li.appendChild(sample_link);
        samples_ol.appendChild(sample_li);
    }

    li.appendChild(samples_ol);

    const audit_status = getState()?.auditStatus;
    const all_samples_for_req = samples.filter(sample => {
        const sample_set = sample?.id ? relevant_ids_by_sample.get(sample.id) : null;
        if (!sample_set) return false;
        return [...candidates].some(id => sample_set.has(id));
    });
    const has_unreviewed = all_samples_for_req.some(sample => {
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
        return status === 'not_audited' || status === 'partially_audited';
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
export function create_requirement_list_item(req, sample, requirements, AuditLogic, Helpers, Translation) {
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

    const h3 = Helpers.create_element('h3', { class_name: 'requirement-header-nested requirement-title-container' });
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
    li.appendChild(h3);

    const details_row_div = Helpers.create_element('div', { class_name: 'requirement-details-row' });
    const status_tooltip_text = t(`audit_status_${base_status}`);
    const icons_wrapper = Helpers.create_element('span', { class_name: 'status-icons-wrapper' });
    const status_icon_wrapper = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
    const status_icon = Helpers.create_element('span', {
        class_name: `status-icon status-icon-${base_status.replace('_', '-')}`,
        text_content: get_status_icon(base_status),
        attributes: { 'aria-hidden': 'true' }
    });
    const status_tooltip = Helpers.create_element('span', {
        class_name: 'status-icon-tooltip',
        text_content: status_tooltip_text,
        attributes: { 'aria-hidden': 'true' }
    });
    status_icon_wrapper.appendChild(status_icon);
    status_icon_wrapper.appendChild(status_tooltip);
    icons_wrapper.appendChild(status_icon_wrapper);
    if (needs_help) {
        const warning_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('warning', ['currentColor'], 14) : '';
        const needs_help_wrapper = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
        const needs_help_icon = Helpers.create_element('span', {
            class_name: 'status-icon status-icon-needs-help-indicator',
            html_content: warning_svg,
            attributes: { 'aria-hidden': 'true' }
        });
        const needs_help_tooltip = Helpers.create_element('span', {
            class_name: 'status-icon-tooltip',
            text_content: t('filter_option_needs_help'),
            attributes: { 'aria-hidden': 'true' }
        });
        needs_help_wrapper.appendChild(needs_help_icon);
        needs_help_wrapper.appendChild(needs_help_tooltip);
        icons_wrapper.appendChild(needs_help_wrapper);
    }
    if (is_updated) {
        const update_svg = Helpers.get_icon_svg ? Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
        const updated_wrapper = Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
        const updated_icon = Helpers.create_element('span', {
            class_name: 'status-icon status-icon-updated-indicator',
            html_content: update_svg,
            attributes: { 'aria-hidden': 'true' }
        });
        const updated_tooltip = Helpers.create_element('span', {
            class_name: 'status-icon-tooltip',
            text_content: t('status_updated_tooltip'),
            attributes: { 'aria-hidden': 'true' }
        });
        updated_wrapper.appendChild(updated_icon);
        updated_wrapper.appendChild(updated_tooltip);
        icons_wrapper.appendChild(updated_wrapper);
    }

    details_row_div.appendChild(icons_wrapper);

    const total_checks = req.checks?.length || 0;
    const audited_checks = req_result?.checkResults ? Object.values(req_result.checkResults).filter(res => res.status === 'passed' || res.status === 'failed').length : 0;
    details_row_div.appendChild(Helpers.create_element('span', { class_name: 'requirement-checks-info', text_content: `(${audited_checks}/${total_checks} ${t('checks_short')})` }));

    if (req.standardReference?.text) {
        const t_ref = Translation?.t || (k => (k === 'opens_in_new_tab' ? '(Öppnas i ny flik)' : k));
        const icon_html = Helpers.get_external_link_icon_html ? Helpers.get_external_link_icon_html(t_ref) : ' ↗';
        details_row_div.appendChild(req.standardReference.url
            ? Helpers.create_element('a', { class_name: 'list-reference-link', html_content: (Helpers.escape_html ? Helpers.escape_html(req.standardReference.text) : req.standardReference.text) + icon_html, attributes: { href: req.standardReference.url, target: '_blank', rel: 'noopener noreferrer' } })
            : Helpers.create_element('span', { class_name: 'list-reference-text', text_content: req.standardReference.text })
        );
    }

    li.appendChild(details_row_div);
    return li;
}
