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

    const audited_requirements_count = all_relevant_requirements.filter(req => {
        const status = AuditLogic.calculate_requirement_status(req, (current_sample_object.requirementResults || {})[req.key]);
        return status === 'passed' || status === 'failed';
    }).length;

    const sample_audit_status_p = Helpers.create_element('p', { class_name: 'sample-info-display sample-audit-progress' });
    const strong_element2 = Helpers.create_element('strong', { text_content: t('requirements_audited_for_sample') });
    sample_audit_status_p.appendChild(strong_element2);
    sample_audit_status_p.appendChild(document.createTextNode(': '));
    sample_audit_status_p.appendChild(document.createTextNode(`${audited_requirements_count}/${all_relevant_requirements.length}`));
    header_element_ref.appendChild(sample_audit_status_p);

    if (ProgressBarComponent) {
        header_element_ref.appendChild(ProgressBarComponent.create(audited_requirements_count, all_relevant_requirements.length, {}));
    }
}
