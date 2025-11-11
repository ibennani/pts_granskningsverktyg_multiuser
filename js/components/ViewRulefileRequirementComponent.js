// js/components/ViewRulefileRequirementComponent.js

import { marked } from '../utils/markdown.js';

export const ViewRulefileRequirementComponent = (function () {
    'use-strict';

    const CSS_PATH = 'css/components/requirement_audit_component.css';
    let app_container_ref;
    let router_ref;
    let params_ref;
    let plate_element_ref = null;

    let local_getState;
    let Translation_t;
    let Helpers_create_element, Helpers_get_icon_svg, Helpers_load_css, Helpers_add_protocol_if_missing;
    let NotificationComponent_get_global_message_element_reference;

    function assign_globals_once() {
        if (Translation_t) return;
        Translation_t = window.Translation.t;
        Helpers_create_element = window.Helpers.create_element;
        Helpers_get_icon_svg = window.Helpers.get_icon_svg;
        Helpers_load_css = window.Helpers.load_css;
        Helpers_add_protocol_if_missing = window.Helpers.add_protocol_if_missing;
        NotificationComponent_get_global_message_element_reference = window.NotificationComponent.get_global_message_element_reference;
    }

    async function init(_app_container, _router_cb, _params, _getState) {
        assign_globals_once();
        app_container_ref = _app_container;
        router_ref = _router_cb;
        params_ref = _params;
        local_getState = _getState;
        
        await Helpers_load_css(CSS_PATH).catch(e => console.warn(e));
    }

    function _safe_parse_markdown(markdown_string, is_inline = false) {
        if (typeof marked === 'undefined' || !window.Helpers.escape_html) {
            return window.Helpers.escape_html(markdown_string);
        }

        const renderer = new marked.Renderer();
        renderer.link = (href, title, text) => {
            const safe_href = window.Helpers.escape_html(href);
            const safe_text = window.Helpers.escape_html(text);
            return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
        };
        
        // Escape ren HTML-kod så den visas som text, men respektera markdown-genererad HTML
        renderer.html = (html_token) => {
            const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof html_token.text === 'string')
                ? html_token.text
                : String(html_token || '');
            
            return window.Helpers.escape_html(text_to_escape);
        };

        const options = { renderer, breaks: true, gfm: true };
        
        // Använd alltid parse() för att hantera både block- och inline-markdown samt HTML-kod
        const parsed_markdown = marked.parse(String(markdown_string || ''), options);
        
        // Använd sanitize_html om tillgängligt för extra säkerhet
        if (window.Helpers.sanitize_html) {
            return window.Helpers.sanitize_html(parsed_markdown);
        }
        
        return parsed_markdown;
    }

    function _render_markdown_section(title_key, content_data) {
        const t = Translation_t;
        const processed_content = Array.isArray(content_data) ? content_data.join('\n\n') : content_data;

        if (!processed_content || (typeof processed_content === 'string' && !processed_content.trim())) {
            return null;
        }
        
        const section_div = Helpers_create_element('div', { class_name: 'audit-section' });
        section_div.appendChild(Helpers_create_element('h2', { text_content: t(title_key) }));
        
        const content_element = Helpers_create_element('div', { 
            class_name: ['audit-section-content', 'markdown-content'],
            html_content: _safe_parse_markdown(processed_content)
        });
        
        section_div.appendChild(content_element);
        return section_div;
    }

    function render() {
        const t = Translation_t;
        app_container_ref.innerHTML = '';
        plate_element_ref = Helpers_create_element('div', { class_name: 'content-plate requirement-audit-plate' });
        
        const requirement_id = params_ref?.id;
        const current_state = local_getState();
        const requirement = current_state?.ruleFileContent?.requirements[requirement_id];

        if (!requirement) {
            plate_element_ref.appendChild(Helpers_create_element('h1', { text_content: t('error_internal') }));
            plate_element_ref.appendChild(Helpers_create_element('p', { text_content: t('error_loading_sample_or_requirement_data') }));
            app_container_ref.appendChild(plate_element_ref);
            return;
        }

        // Header
        const header_div = Helpers_create_element('div', { class_name: 'requirement-audit-header' });
        const title_wrapper = Helpers_create_element('div', { class_name: 'requirement-audit-header-title-wrapper' });
        const h1_element = Helpers_create_element('h1', { text_content: requirement.title, id: 'view-requirement-h1', attributes: { tabindex: '-1' } });
        title_wrapper.appendChild(h1_element);
        
        const edit_button = Helpers_create_element('button', {
            class_name: ['button', 'button-secondary', 'button-small', 'edit-button'],
            attributes: { 'aria-label': t('edit_this_requirement_aria', { requirementTitle: requirement.title }) },
            html_content: `<span>${t('edit_prefix')}</span>` + Helpers_get_icon_svg('edit', [], 16)
        });
        edit_button.addEventListener('click', () => {
            router_ref('rulefile_edit_requirement', { id: requirement_id });
        });
        title_wrapper.appendChild(edit_button);

        header_div.appendChild(title_wrapper);
        plate_element_ref.appendChild(header_div);

        // Top Navigation
        const top_nav_bar = Helpers_create_element('div', { class_name: 'audit-navigation-buttons top-nav' });
        const back_button_top = Helpers_create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_requirement_list')}</span>` + Helpers_get_icon_svg('arrow_back')
        });
        back_button_top.addEventListener('click', () => router_ref('rulefile_requirements'));
        top_nav_bar.appendChild(back_button_top);
        plate_element_ref.appendChild(top_nav_bar);

        // General Info (Reference)
        if (requirement.standardReference && requirement.standardReference.text) {
             const general_info_section = Helpers_create_element('div', { class_name: 'audit-section' });
             const p = Helpers_create_element('p', { class_name: 'standard-reference' });
             p.appendChild(Helpers_create_element('strong', { text_content: `${t('requirement_standard_reference_label')} ` }));
             if (requirement.standardReference.url) {
                 p.appendChild(Helpers_create_element('a', {
                     text_content: requirement.standardReference.text,
                     attributes: { href: Helpers_add_protocol_if_missing(requirement.standardReference.url), target: '_blank' }
                 }));
             } else {
                 p.appendChild(document.createTextNode(requirement.standardReference.text));
             }
             general_info_section.appendChild(p);
             plate_element_ref.appendChild(general_info_section);
        }

        // Help Texts
        const help_text_sections = [
            _render_markdown_section('requirement_expected_observation', requirement.expectedObservation),
            _render_markdown_section('requirement_instructions', requirement.instructions),
            _render_markdown_section('requirement_exceptions', requirement.exceptions),
            _render_markdown_section('requirement_common_errors', requirement.commonErrors),
            _render_markdown_section('requirement_tips', requirement.tips),
            _render_markdown_section('requirement_examples', requirement.examples)
        ];
        help_text_sections.filter(Boolean).forEach(sec => plate_element_ref.appendChild(sec));
        
        // Checkpoints
        const checks_container = Helpers_create_element('div', { class_name: 'checks-container audit-section' });
        checks_container.appendChild(Helpers_create_element('h2', { text_content: t('checks_title') }));
        (requirement.checks || []).forEach((check, check_index) => {
            const check_wrapper = Helpers_create_element('div', { class_name: 'check-item status-not_audited', style: 'border-left-width: 3px;' });
            const condition_h3 = Helpers_create_element('h3', { class_name: 'check-condition-title', html_content: _safe_parse_markdown(check.condition) });
            check_wrapper.appendChild(condition_h3);
            const check_number_label = Helpers_create_element('p', {
                class_name: 'check-number-label',
                text_content: `${t('check_item_title')} ${check_index + 1}`
            });
            check_wrapper.appendChild(check_number_label);
            const logic_key = check.logic?.toUpperCase() === 'OR' ? 'check_logic_or' : 'check_logic_and';
            const logic_label = t(logic_key);
            check_wrapper.appendChild(Helpers_create_element('p', { class_name: 'text-muted', html_content: `<strong>${t('check_logic_display')}</strong> ${logic_label}`}));
            if (check.passCriteria && check.passCriteria.length > 0) {
                const pc_list = Helpers_create_element('ul', { class_name: 'pass-criteria-list' });
                check.passCriteria.forEach((pc, pc_index) => {
                    const pc_item = Helpers_create_element('li', { class_name: 'pass-criterion-item' });
                    const numbering = `${check_index + 1}.${pc_index + 1}`;
                    const numbering_label = Helpers_create_element('p', {
                        class_name: 'pass-criterion-number-label',
                        text_content: `${t('pass_criterion_label')} ${numbering}`
                    });
                    const criterion_heading = Helpers_create_element('div', {
                        class_name: ['pass-criterion-heading', 'markdown-content'],
                        html_content: _safe_parse_markdown(pc.requirement)
                    });
                    pc_item.appendChild(numbering_label);
                    pc_item.appendChild(criterion_heading);
                    if(pc.failureStatementTemplate) {
                        const template_div = Helpers_create_element('div', { class_name: 'failure-template-display' });
                        const template_strong = Helpers_create_element('strong', { text_content: t('failure_statement_template_display') });
                        template_div.appendChild(template_strong);
                        template_div.appendChild(Helpers_create_element('p', { text_content: pc.failureStatementTemplate }));
                        pc_item.appendChild(template_div);
                    }
                    pc_list.appendChild(pc_item);
                });
                check_wrapper.appendChild(pc_list);
            }
            checks_container.appendChild(check_wrapper);
        });
        plate_element_ref.appendChild(checks_container);
        
        // Classification
        const classification_section = Helpers_create_element('div', { class_name: 'audit-section' });
        classification_section.appendChild(Helpers_create_element('h2', { text_content: t('classification_title') }));
        const classification_ul = Helpers_create_element('ul', { class_name: 'requirement-metadata-list' });
        if (requirement.metadata?.mainCategory?.text) {
            classification_ul.appendChild(Helpers_create_element('li', { html_content: `<strong>${t('main_category_text')}:</strong> ${requirement.metadata.mainCategory.text}` }));
        }
        if (requirement.metadata?.subCategory?.text) {
            classification_ul.appendChild(Helpers_create_element('li', { html_content: `<strong>${t('sub_category_text')}:</strong> ${requirement.metadata.subCategory.text}` }));
        }
        if (classification_ul.hasChildNodes()) {
            classification_section.appendChild(classification_ul);
            plate_element_ref.appendChild(classification_section);
        }
        
        // --- START OF CHANGE: Separate WCAG Principles section ---
        const pour_taxonomy = current_state.ruleFileContent.metadata.taxonomies.find(tax => tax.id === 'wcag22-pour');
        if (pour_taxonomy && requirement.classifications?.length > 0) {
            const concepts = requirement.classifications
                .filter(c => c.taxonomyId === 'wcag22-pour')
                .map(c => pour_taxonomy.concepts.find(p => p.id === c.conceptId)?.label)
                .filter(Boolean);

            if (concepts.length > 0) {
                const pour_section = Helpers_create_element('div', { class_name: 'audit-section' });
                pour_section.appendChild(Helpers_create_element('h2', { text_content: t('wcag_principles_title') }));
                const pour_ul = Helpers_create_element('ul', { class_name: 'requirement-metadata-list' });
                concepts.forEach(conceptName => {
                    pour_ul.appendChild(Helpers_create_element('li', { text_content: conceptName }));
                });
                pour_section.appendChild(pour_ul);
                plate_element_ref.appendChild(pour_section);
            }
        }
        // --- END OF CHANGE ---
        
        // Impact
        const impact_section = Helpers_create_element('div', { class_name: 'audit-section' });
        impact_section.appendChild(Helpers_create_element('h2', { text_content: t('impact_title') }));
        const impact_ul = Helpers_create_element('ul', { class_name: 'requirement-metadata-list' });
        if (requirement.metadata?.impact) {
            const impact = requirement.metadata.impact;
            impact_ul.appendChild(Helpers_create_element('li', { html_content: `<strong>${t('is_critical')}:</strong> ${impact.isCritical ? t('yes') : t('no')}` }));
            impact_ul.appendChild(Helpers_create_element('li', { html_content: `<strong>${t('primary_score')}:</strong> ${impact.primaryScore || 0}` }));
            impact_ul.appendChild(Helpers_create_element('li', { html_content: `<strong>${t('secondary_score')}:</strong> ${impact.secondaryScore || 0}` }));
        }
         if (impact_ul.hasChildNodes()) {
            impact_section.appendChild(impact_ul);
            plate_element_ref.appendChild(impact_section);
        }

        // Associated Content Types
        if (requirement.contentType?.length > 0) {
            const content_types_section = Helpers_create_element('div', { class_name: 'audit-section' });
            content_types_section.appendChild(Helpers_create_element('h2', { text_content: t('content_types_associated') }));
            const content_types_ul = Helpers_create_element('ul', { class_name: 'requirement-metadata-list' });
            const content_types_map = new Map();
            (current_state.ruleFileContent.metadata.contentTypes || []).forEach(parent => {
                (parent.types || []).forEach(child => content_types_map.set(child.id, child.text));
            });
            requirement.contentType.forEach(ct_id => {
                content_types_ul.appendChild(Helpers_create_element('li', { text_content: content_types_map.get(ct_id) || ct_id }));
            });
            content_types_section.appendChild(content_types_ul);
            plate_element_ref.appendChild(content_types_section);
        }

        // Bottom Navigation
        const bottom_nav_bar = Helpers_create_element('div', { class_name: 'audit-navigation-buttons bottom-nav' });
        const back_button_bottom = Helpers_create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_requirement_list')}</span>` + Helpers_get_icon_svg('arrow_back')
        });
        back_button_bottom.addEventListener('click', () => router_ref('rulefile_requirements'));
        bottom_nav_bar.appendChild(back_button_bottom);
        plate_element_ref.appendChild(bottom_nav_bar);

        app_container_ref.appendChild(plate_element_ref);
        setTimeout(() => h1_element.focus(), 0);
    }

    function destroy() {
        if (app_container_ref) {
            // Rensa event listeners innan vi rensar HTML
            const buttons = app_container_ref.querySelectorAll('button');
            buttons.forEach(button => {
                // Skapa en kopia för att ta bort event listeners
                button.replaceWith(button.cloneNode(true));
            });
            app_container_ref.innerHTML = '';
        }
        plate_element_ref = null;
    }

    return { init, render, destroy };
})();
