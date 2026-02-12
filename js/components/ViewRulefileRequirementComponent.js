// js/components/ViewRulefileRequirementComponent.js

import { marked, auto_convert_code_like_to_codeblocks } from '../utils/markdown.js';

export const ViewRulefileRequirementComponent = {
    CSS_PATH: 'css/components/requirement_audit_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.params = deps.params;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        
        this.plate_element_ref = null;

        await this.Helpers.load_css(this.CSS_PATH).catch(e => console.warn(e));
    },

    _safe_parse_markdown(markdown_string, is_inline = false) {
        if (typeof marked === 'undefined' || !this.Helpers.escape_html) {
            return this.Helpers.escape_html(markdown_string);
        }

        // Automatiskt konvertera kod-liknande text till kodblock för att bevara radbrytningar
        const processed_markdown = auto_convert_code_like_to_codeblocks(String(markdown_string || ''));

        const renderer = new marked.Renderer();
        renderer.link = (href, title, text) => {
            const safe_href = this.Helpers.escape_html(href);
            const safe_text = this.Helpers.escape_html(text);
            return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
        };
        
        // Escape ren HTML-kod så den visas som text, men respektera markdown-genererad HTML
        renderer.html = (html_token) => {
            const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof html_token.text === 'string')
                ? html_token.text
                : String(html_token || '');
            
            return this.Helpers.escape_html(text_to_escape);
        };

        const options = { renderer, breaks: true, gfm: true };
        
        // Använd alltid parse() för att hantera både block- och inline-markdown samt HTML-kod
        const parsed_markdown = marked.parse(processed_markdown, options);
        
        // Använd sanitize_html om tillgängligt för extra säkerhet
        if (this.Helpers.sanitize_html) {
            return this.Helpers.sanitize_html(parsed_markdown);
        }
        
        return parsed_markdown;
    },

    _render_markdown_section(title_key, content_data) {
        const t = this.Translation.t;
        const processed_content = Array.isArray(content_data) ? content_data.join('\n\n') : content_data;

        if (!processed_content || (typeof processed_content === 'string' && !processed_content.trim())) {
            return null;
        }
        
        const section_div = this.Helpers.create_element('div', { class_name: 'audit-section' });
        section_div.appendChild(this.Helpers.create_element('h2', { text_content: t(title_key) }));
        
        const content_element = this.Helpers.create_element('div', { 
            class_name: ['audit-section-content', 'markdown-content'],
            html_content: this._safe_parse_markdown(processed_content)
        });
        
        section_div.appendChild(content_element);
        return section_div;
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate requirement-audit-plate' });
        
        const requirement_id = this.params?.id;
        const current_state = this.getState();
        const requirement = current_state?.ruleFileContent?.requirements[requirement_id];

        if (!requirement) {
            this.plate_element_ref.appendChild(this.Helpers.create_element('h1', { text_content: t('error_internal') }));
            this.plate_element_ref.appendChild(this.Helpers.create_element('p', { text_content: t('error_loading_sample_or_requirement_data') }));
            this.root.appendChild(this.plate_element_ref);
            return;
        }

        // Header
        const header_div = this.Helpers.create_element('div', { class_name: 'requirement-audit-header' });
        const title_wrapper = this.Helpers.create_element('div', { class_name: 'requirement-audit-header-title-wrapper' });
        const h1_element = this.Helpers.create_element('h1', { text_content: requirement.title, id: 'main-content-heading', attributes: { tabindex: '-1' } });
        title_wrapper.appendChild(h1_element);
        
        const edit_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary', 'button-small', 'edit-button'],
            attributes: { 'aria-label': t('edit_this_requirement_aria', { requirementTitle: requirement.title }) },
            html_content: `<span>${t('edit_prefix')}</span>` + this.Helpers.get_icon_svg('edit', [], 16)
        });
        edit_button.addEventListener('click', () => {
            this.router('rulefile_edit_requirement', { id: requirement_id });
        });
        title_wrapper.appendChild(edit_button);

        header_div.appendChild(title_wrapper);
        this.plate_element_ref.appendChild(header_div);

        // Top Navigation
        const top_nav_bar = this.Helpers.create_element('div', { class_name: 'audit-navigation-buttons top-nav' });
        const back_button_top = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_requirement_list')}</span>` + this.Helpers.get_icon_svg('arrow_back')
        });
        back_button_top.addEventListener('click', () => {
            try {
                window.sessionStorage?.setItem('gv_return_focus_rulefile_requirements_list_v1', JSON.stringify({
                    requirementId: requirement_id,
                    createdAt: Date.now()
                }));
            } catch (e) {}
            this.router('rulefile_requirements');
        });
        top_nav_bar.appendChild(back_button_top);
        this.plate_element_ref.appendChild(top_nav_bar);

        // General Info (Reference)
        if (requirement.standardReference && requirement.standardReference.text) {
             const general_info_section = this.Helpers.create_element('div', { class_name: 'audit-section' });
             const p = this.Helpers.create_element('p', { class_name: 'standard-reference' });
             p.appendChild(this.Helpers.create_element('strong', { text_content: `${t('requirement_standard_reference_label')} ` }));
             if (requirement.standardReference.url) {
                 p.appendChild(this.Helpers.create_element('a', {
                     text_content: requirement.standardReference.text,
                     attributes: { href: this.Helpers.add_protocol_if_missing(requirement.standardReference.url), target: '_blank' }
                 }));
             } else {
                 p.appendChild(document.createTextNode(requirement.standardReference.text));
             }
             general_info_section.appendChild(p);
             this.plate_element_ref.appendChild(general_info_section);
        }

        // Help Texts - Support both old format (direct fields) and new format (infoBlocks)
        const has_info_blocks = requirement.infoBlocks && typeof requirement.infoBlocks === 'object';
        const block_order = current_state.ruleFileContent.metadata?.blockOrders?.infoBlocks || [];
        
        if (has_info_blocks) {
            // New format: use infoBlocks with ordering from metadata.blockOrders.infoBlocks
            const info_blocks = requirement.infoBlocks;
            const ordered_block_ids = [...block_order];
            
            // Add any blocks that exist in infoBlocks but not in the order list (render them last)
            const extra_block_ids = Object.keys(info_blocks).filter(id => !ordered_block_ids.includes(id));
            ordered_block_ids.push(...extra_block_ids);
            
            ordered_block_ids.forEach(block_id => {
                const block = info_blocks[block_id];
                if (!block || !block.text || (typeof block.text === 'string' && !block.text.trim())) {
                    return; // Skip empty blocks
                }
                
                // Create accordion-style section
                const section_div = this.Helpers.create_element('div', { class_name: 'audit-section info-block-section' });
                
                // Create accordion header
                const header = this.Helpers.create_element('div', { 
                    class_name: ['info-block-header', block.expanded === false ? 'collapsed' : 'expanded'],
                    attributes: { role: 'button', tabindex: '0', 'aria-expanded': block.expanded !== false ? 'true' : 'false' }
                });
                header.appendChild(this.Helpers.create_element('h2', { text_content: block.name || block_id }));
                
                // Create content container
                const content_element = this.Helpers.create_element('div', { 
                    class_name: ['audit-section-content', 'markdown-content', 'info-block-content'],
                    style: block.expanded === false ? 'display: none;' : ''
                });
                content_element.innerHTML = this._safe_parse_markdown(block.text);
                
                // Toggle functionality
                header.addEventListener('click', () => {
                    const is_expanded = header.getAttribute('aria-expanded') === 'true';
                    header.setAttribute('aria-expanded', !is_expanded ? 'true' : 'false');
                    header.classList.toggle('collapsed', is_expanded);
                    header.classList.toggle('expanded', !is_expanded);
                    content_element.style.display = is_expanded ? 'none' : '';
                });
                
                header.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        header.click();
                    }
                });
                
                section_div.appendChild(header);
                section_div.appendChild(content_element);
                this.plate_element_ref.appendChild(section_div);
            });
        } else {
            // Old format: fallback to direct fields (for backward compatibility)
            const help_text_sections = [
                this._render_markdown_section('requirement_expected_observation', requirement.expectedObservation),
                this._render_markdown_section('requirement_instructions', requirement.instructions),
                this._render_markdown_section('requirement_exceptions', requirement.exceptions),
                this._render_markdown_section('requirement_common_errors', requirement.commonErrors),
                this._render_markdown_section('requirement_tips', requirement.tips),
                this._render_markdown_section('requirement_examples', requirement.examples)
            ];
            help_text_sections.filter(Boolean).forEach(sec => this.plate_element_ref.appendChild(sec));
        }
        
        // Checkpoints
        const checks_container = this.Helpers.create_element('div', { class_name: 'checks-container audit-section' });
        checks_container.appendChild(this.Helpers.create_element('h2', { text_content: t('checks_title') }));
        (requirement.checks || []).forEach((check, check_index) => {
            const check_wrapper = this.Helpers.create_element('div', { class_name: 'check-item status-not_audited', style: 'border-left-width: 3px;' });
            // Kontrollpunkt nummer först
            const check_number_label = this.Helpers.create_element('p', {
                class_name: 'check-number-label',
                text_content: `${t('check_item_title')} ${check_index + 1}:`
            });
            check_wrapper.appendChild(check_number_label);
            // Sedan villkoret
            const condition_h3 = this.Helpers.create_element('h3', { class_name: 'check-condition-title', html_content: this._safe_parse_markdown(check.condition) });
            check_wrapper.appendChild(condition_h3);
            // Slutligen logiken
            const logic_key = check.logic?.toUpperCase() === 'OR' ? 'check_logic_or' : 'check_logic_and';
            const logic_label = t(logic_key);
            check_wrapper.appendChild(this.Helpers.create_element('p', { class_name: 'text-muted', html_content: `<strong>${t('check_logic_display')}</strong> ${logic_label}`}));
            if (check.passCriteria && check.passCriteria.length > 0) {
                const pc_list = this.Helpers.create_element('ul', { class_name: 'pass-criteria-list' });
                check.passCriteria.forEach((pc, pc_index) => {
                    const pc_item = this.Helpers.create_element('li', { class_name: 'pass-criterion-item' });
                    const numbering = `${check_index + 1}.${pc_index + 1}`;
                    const numbering_label = this.Helpers.create_element('p', {
                        class_name: 'pass-criterion-number-label',
                        text_content: `${t('pass_criterion_label')} ${numbering}`
                    });
                    const criterion_heading = this.Helpers.create_element('div', {
                        class_name: ['pass-criterion-heading', 'markdown-content'],
                        html_content: this._safe_parse_markdown(pc.requirement)
                    });
                    pc_item.appendChild(numbering_label);
                    pc_item.appendChild(criterion_heading);
                    if(pc.failureStatementTemplate) {
                        const template_div = this.Helpers.create_element('div', { class_name: 'failure-template-display' });
                        const template_strong = this.Helpers.create_element('strong', { text_content: t('failure_statement_template_display') });
                        template_div.appendChild(template_strong);
                        template_div.appendChild(this.Helpers.create_element('p', { text_content: pc.failureStatementTemplate }));
                        pc_item.appendChild(template_div);
                    }
                    pc_list.appendChild(pc_item);
                });
                check_wrapper.appendChild(pc_list);
            }
            checks_container.appendChild(check_wrapper);
        });
        this.plate_element_ref.appendChild(checks_container);
        
        // Classification
        const classification_section = this.Helpers.create_element('div', { class_name: 'audit-section' });
        classification_section.appendChild(this.Helpers.create_element('h2', { text_content: t('classification_title') }));
        const classification_ul = this.Helpers.create_element('ul', { class_name: 'requirement-metadata-list' });
        if (requirement.metadata?.mainCategory?.text) {
            classification_ul.appendChild(this.Helpers.create_element('li', { html_content: `<strong>${t('main_category_text')}:</strong> ${requirement.metadata.mainCategory.text}` }));
        }
        if (requirement.metadata?.subCategory?.text) {
            classification_ul.appendChild(this.Helpers.create_element('li', { html_content: `<strong>${t('sub_category_text')}:</strong> ${requirement.metadata.subCategory.text}` }));
        }
        if (classification_ul.hasChildNodes()) {
            classification_section.appendChild(classification_ul);
            this.plate_element_ref.appendChild(classification_section);
        }
        
        // WCAG Principles section
        const taxonomies = current_state.ruleFileContent.metadata?.vocabularies?.taxonomies || current_state.ruleFileContent.metadata?.taxonomies || [];
        const pour_taxonomy = taxonomies.find(tax => tax.id === 'wcag22-pour');
        if (pour_taxonomy && requirement.classifications?.length > 0) {
            const concepts = requirement.classifications
                .filter(c => c.taxonomyId === 'wcag22-pour')
                .map(c => pour_taxonomy.concepts.find(p => p.id === c.conceptId)?.label)
                .filter(Boolean);

            if (concepts.length > 0) {
                const pour_section = this.Helpers.create_element('div', { class_name: 'audit-section' });
                pour_section.appendChild(this.Helpers.create_element('h2', { text_content: t('wcag_principles_title') }));
                const pour_ul = this.Helpers.create_element('ul', { class_name: 'requirement-metadata-list' });
                concepts.forEach(conceptName => {
                    pour_ul.appendChild(this.Helpers.create_element('li', { text_content: conceptName }));
                });
                pour_section.appendChild(pour_ul);
                this.plate_element_ref.appendChild(pour_section);
            }
        }
        
        // Impact
        const impact_section = this.Helpers.create_element('div', { class_name: 'audit-section' });
        impact_section.appendChild(this.Helpers.create_element('h2', { text_content: t('impact_title') }));
        const impact_ul = this.Helpers.create_element('ul', { class_name: 'requirement-metadata-list' });
        if (requirement.metadata?.impact) {
            const impact = requirement.metadata.impact;
            impact_ul.appendChild(this.Helpers.create_element('li', { html_content: `<strong>${t('is_critical')}:</strong> ${impact.isCritical ? t('yes') : t('no')}` }));
            impact_ul.appendChild(this.Helpers.create_element('li', { html_content: `<strong>${t('primary_score')}:</strong> ${impact.primaryScore || 0}` }));
            impact_ul.appendChild(this.Helpers.create_element('li', { html_content: `<strong>${t('secondary_score')}:</strong> ${impact.secondaryScore || 0}` }));
        }
         if (impact_ul.hasChildNodes()) {
            impact_section.appendChild(impact_ul);
            this.plate_element_ref.appendChild(impact_section);
        }

        // Associated Content Types
        if (requirement.contentType?.length > 0) {
            const content_types_section = this.Helpers.create_element('div', { class_name: 'audit-section' });
            content_types_section.appendChild(this.Helpers.create_element('h2', { text_content: t('content_types_associated') }));
            const content_types_ul = this.Helpers.create_element('ul', { class_name: 'requirement-metadata-list' });
            const content_types_map = new Map();
            const content_types = current_state.ruleFileContent.metadata?.vocabularies?.contentTypes || current_state.ruleFileContent.metadata?.contentTypes || [];
            content_types.forEach(parent => {
                (parent.types || []).forEach(child => content_types_map.set(child.id, child.text));
            });
            requirement.contentType.forEach(ct_id => {
                content_types_ul.appendChild(this.Helpers.create_element('li', { text_content: content_types_map.get(ct_id) || ct_id }));
            });
            content_types_section.appendChild(content_types_ul);
            this.plate_element_ref.appendChild(content_types_section);
        }

        // Bottom Navigation
        const bottom_nav_bar = this.Helpers.create_element('div', { class_name: 'audit-navigation-buttons bottom-nav' });
        const back_button_bottom = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            html_content: `<span>${t('back_to_requirement_list')}</span>` + this.Helpers.get_icon_svg('arrow_back')
        });
        back_button_bottom.addEventListener('click', () => {
            try {
                window.sessionStorage?.setItem('gv_return_focus_rulefile_requirements_list_v1', JSON.stringify({
                    requirementId: requirement_id,
                    createdAt: Date.now()
                }));
            } catch (e) {}
            this.router('rulefile_requirements');
        });
        bottom_nav_bar.appendChild(back_button_bottom);
        this.plate_element_ref.appendChild(bottom_nav_bar);

        this.root.appendChild(this.plate_element_ref);
        setTimeout(() => h1_element.focus(), 0);
    },

    destroy() {
        if (this.root) {
            // Rensa event listeners innan vi rensar HTML
            const buttons = this.root.querySelectorAll('button');
            buttons.forEach(button => {
                // Skapa en kopia för att ta bort event listeners
                button.replaceWith(button.cloneNode(true));
            });
            this.root.innerHTML = '';
        }
        this.plate_element_ref = null;
        this.root = null;
        this.deps = null;
    }
};
