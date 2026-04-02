/**
 * Rubrik och stickprovsinformation ovanför kravlistan (ett stickprov).
 * @module js/components/requirements_list/requirement_list_sample_header
 */

import { ProgressBarComponent } from '../ProgressBarComponent.js';

/**
 * @param {object} state
 * @param {object} current_sample_object
 * @param {object[]} all_relevant_requirements
 * @param {HTMLElement|null|undefined} header_element_ref
 * @param {object} Helpers
 * @param {object} Translation
 * @param {object} AuditLogic
 */
export function render_sample_header(state, current_sample_object, all_relevant_requirements, header_element_ref, Helpers, Translation, AuditLogic) {
    const t = Translation.t;
    if (!header_element_ref) return;

    header_element_ref.innerHTML = '';

    const actor_name = state.auditMetadata?.actorName || '';
    const sample_description = current_sample_object.description || t('undefined_description');
    const title_text = (actor_name.trim() !== '') ? `${actor_name.trim()}: ${sample_description}` : sample_description;

    const h1 = Helpers.create_element('h1');
    if (current_sample_object.url) {
        const icon_html = Helpers.get_external_link_icon_html ? Helpers.get_external_link_icon_html(t) : ' ↗';
        h1.appendChild(Helpers.create_element('a', {
            html_content: (Helpers.escape_html ? Helpers.escape_html(title_text) : title_text) + icon_html,
            attributes: { href: Helpers.add_protocol_if_missing(current_sample_object.url), target: '_blank', rel: 'noopener noreferrer' }
        }));
    } else {
        h1.textContent = title_text;
    }
    header_element_ref.appendChild(h1);

    const sample_categories_map = new Map();
    (state.ruleFileContent.metadata.samples?.sampleCategories || []).forEach(cat => {
        sample_categories_map.set(cat.id, cat.text);
    });
    const category_text = sample_categories_map.get(current_sample_object.sampleCategory) || current_sample_object.sampleCategory;
    const type_info_string = `${current_sample_object.sampleType || ''} (${category_text || ''})`;

    const sample_type_p = Helpers.create_element('p', { class_name: 'sample-info-display sample-page-type' });
    const strong_element = Helpers.create_element('strong', { text_content: t('page_type') });
    sample_type_p.appendChild(strong_element);
    sample_type_p.appendChild(document.createTextNode(': '));
    sample_type_p.appendChild(document.createTextNode(Helpers.escape_html(type_info_string)));
    header_element_ref.appendChild(sample_type_p);

    const status_counts = AuditLogic.calculate_sample_requirement_status_counts(state.ruleFileContent, current_sample_object);
    const lang_code = (Translation.get_current_language_code && Translation.get_current_language_code()) || 'sv-SE';
    const format_num = (Helpers.format_number_locally && Helpers.format_number_locally.bind(Helpers))
        || ((n) => String(n));

    if (ProgressBarComponent) {
        header_element_ref.appendChild(ProgressBarComponent.create_audit_status_stack({
            counts: status_counts,
            t,
            create_element: Helpers.create_element,
            format_number_locally: format_num,
            lang_code,
            variant: 'default',
            group_labelledby_id: null,
            show_total_line: false,
            overview_distribution_layout: true,
            distribution_heading_id: `requirement-list-sample-distribution-${current_sample_object.id}`
        }));
    }
}
