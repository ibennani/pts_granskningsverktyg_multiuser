/**
 * Ritar listinnehåll (tomma tillstånd, hint, kravlista, fokus).
 * @module js/components/requirements_list/requirement_list_render_content
 */

import { apply_return_focus_if_needed } from './requirement_list_return_focus.js';
import { create_all_requirement_list_item, create_requirement_list_item } from './requirement_list_list_items.js';

/**
 * @param {object} ctx
 * @param {string} ctx.mode
 * @param {object} ctx.Helpers
 * @param {object} ctx.Translation
 * @param {object} ctx.AuditLogic
 * @param {HTMLElement|null|undefined} ctx.content_div_for_delegation
 * @param {HTMLElement|null|undefined} ctx.empty_message_element_ref
 * @param {Map<string, Set<string>>|null|undefined} ctx.relevant_ids_by_sample
 * @param {string|null|undefined} ctx.RETURN_FOCUS_SESSION_KEY
 * @param {string|null|undefined} ctx.sample_params_id
 * @param {() => object} ctx.getState
 * @param {object|Array|null|undefined} ctx.requirements ruleFileContent.requirements
 * @param {Array} items sorterade krav (entries eller kravobjekt)
 * @param {object} params
 * @param {object[]} params.samples
 * @param {object|null|undefined} params.current_sample_object
 * @param {number} params.total_count
 * @param {number} params.filtered_count
 * @param {object} params.filter_opts
 */
export function render_requirements_content(ctx, items, params) {
    const t = ctx.Translation.t;
    const { samples, current_sample_object, total_count, filtered_count, filter_opts } = params;

    if (ctx.content_div_for_delegation) {
        ctx.content_div_for_delegation.innerHTML = '';
    }

    if (ctx.mode === 'all') {
        if (ctx.empty_message_element_ref) {
            ctx.empty_message_element_ref.style.display = 'none';
        }

        if (total_count === 0) {
            if (ctx.empty_message_element_ref) {
                ctx.empty_message_element_ref.textContent = t('all_requirements_empty_no_samples') || t('all_requirements_empty');
                ctx.empty_message_element_ref.style.display = '';
            }
            return;
        }

        if (filtered_count === 0) {
            const hint_p = ctx.Helpers.create_element('p', {
                class_name: 'view-intro-text no-match-hint',
                text_content: t('no_requirements_match_filter_all_hint')
            });
            ctx.content_div_for_delegation.appendChild(hint_p);
            return;
        }

        const req_ul = ctx.Helpers.create_element('ul', { class_name: 'requirement-items-ul' });
        items.forEach(([req_id, req]) => {
            req_ul.appendChild(create_all_requirement_list_item(
                req_id,
                req,
                samples,
                filter_opts,
                ctx.relevant_ids_by_sample,
                ctx.requirements,
                ctx.getState,
                ctx.AuditLogic,
                ctx.Helpers,
                ctx.Translation
            ));
        });
        ctx.content_div_for_delegation.appendChild(req_ul);

        apply_return_focus_if_needed(ctx.content_div_for_delegation, ctx.RETURN_FOCUS_SESSION_KEY, ctx.mode, ctx.sample_params_id);
    } else {
        if (ctx.content_div_for_delegation) {
            ctx.content_div_for_delegation.innerHTML = '';
        }

        if (items.length === 0) {
            if (ctx.content_div_for_delegation) {
                ctx.content_div_for_delegation.appendChild(ctx.Helpers.create_element('p', { text_content: t('no_requirements_match_filter') }));
            }
        } else {
            const req_ol = ctx.Helpers.create_element('ol', { class_name: 'requirement-items-ul' });
            items.forEach(req => {
                req_ol.appendChild(create_requirement_list_item(
                    req,
                    current_sample_object,
                    ctx.requirements,
                    ctx.AuditLogic,
                    ctx.Helpers,
                    ctx.Translation
                ));
            });
            if (ctx.content_div_for_delegation) {
                ctx.content_div_for_delegation.appendChild(req_ol);
            }
        }

        apply_return_focus_if_needed(ctx.content_div_for_delegation, ctx.RETURN_FOCUS_SESSION_KEY, ctx.mode, ctx.sample_params_id);
    }
}
