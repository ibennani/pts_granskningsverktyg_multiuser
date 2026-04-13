/**
 * Bygger DOM-strukturen för kravlistvy (platta, filter, innehåll).
 * @module js/components/requirements_list/requirement_list_build_dom
 */

/**
 * @param {object} ctx
 * @param {HTMLElement} ctx.root
 * @param {string} ctx.mode
 * @param {object} ctx.Helpers
 * @param {object} ctx.Translation
 * @param {function} ctx.handle_requirement_list_click
 * @param {function} ctx.handle_requirement_list_keydown
 * @returns {{
 *   plate_element_ref: HTMLElement,
 *   h1_element_ref: HTMLElement|null,
 *   header_element_ref: HTMLElement|null,
 *   filter_heading_ref: HTMLElement,
 *   filter_container_element: HTMLElement,
 *   results_summary_element_ref: HTMLElement,
 *   empty_message_element_ref: HTMLElement|null,
 *   content_div_for_delegation: HTMLElement
 * }}
 */
export function build_requirements_list_dom(ctx) {
    const { root, mode, Helpers, Translation, handle_requirement_list_click, handle_requirement_list_keydown } = ctx;

    const plate_class = 'content-plate requirement-list-plate';
    const plate_element_ref = Helpers.create_element('div', { class_name: plate_class });

    let h1_element_ref = null;
    let header_element_ref = null;
    if (mode === 'sample') {
        header_element_ref = Helpers.create_element('div', { class_name: 'requirement-list-header' });
        plate_element_ref.appendChild(header_element_ref);
    } else {
        h1_element_ref = Helpers.create_element('h1', { text_content: '' });
        plate_element_ref.appendChild(h1_element_ref);
    }

    const filter_section_id = mode === 'all' ? 'all-requirements-filter-container' : 'requirement-list-filter-container';
    const filter_wrapper = Helpers.create_element('div', {
        id: filter_section_id,
        class_name: 'requirements-list-filter-section'
    });
    const filter_heading_ref = Helpers.create_element('h2', {
        text_content: Translation.t('requirement_audit_sidebar_filter_heading_sample_requirements')
    });
    filter_wrapper.appendChild(filter_heading_ref);
    const filter_container_element = Helpers.create_element('div', { class_name: 'requirement-audit-sidebar__filters-wrapper' });
    filter_wrapper.appendChild(filter_container_element);
    plate_element_ref.appendChild(filter_wrapper);

    const summary_id = mode === 'all' ? 'all-requirements-results-summary' : 'requirement-list-results-summary';
    const results_summary_element_ref = Helpers.create_element('h2', {
        class_name: 'results-summary',
        id: summary_id,
        text_content: '',
        attributes: { 'aria-live': 'polite' }
    });
    plate_element_ref.appendChild(results_summary_element_ref);

    let empty_message_element_ref = null;
    if (mode === 'all') {
        empty_message_element_ref = Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: '',
        });
        empty_message_element_ref.style.display = 'none';
        plate_element_ref.appendChild(empty_message_element_ref);
    }

    const content_div_for_delegation = Helpers.create_element('div', { class_name: 'requirements-list-content' });
    content_div_for_delegation.addEventListener('click', handle_requirement_list_click);
    content_div_for_delegation.addEventListener('keydown', handle_requirement_list_keydown);
    plate_element_ref.appendChild(content_div_for_delegation);

    root.appendChild(plate_element_ref);

    return {
        plate_element_ref,
        h1_element_ref,
        header_element_ref,
        filter_heading_ref,
        filter_container_element,
        results_summary_element_ref,
        empty_message_element_ref,
        content_div_for_delegation
    };
}
