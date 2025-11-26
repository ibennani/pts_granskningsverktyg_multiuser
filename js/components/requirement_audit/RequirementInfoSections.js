// js/components/requirement_audit/RequirementInfoSections.js

import { marked } from '../../utils/markdown.js';

export const RequirementInfoSections = {
    container_ref: null,
    
    // Dependencies
    Translation: null,
    Helpers: null,
    
    init(_container, options = {}) {
        this.container_ref = _container;
        const deps = options.deps || {};
        this.Translation = deps.Translation || window.Translation;
        this.Helpers = deps.Helpers || window.Helpers;
    },
    
    render_markdown_section(title_key, content_data) {
        const t = this.Translation.t;
        if (!content_data || (typeof content_data === 'string' && !content_data.trim())) {
            return null; // Return nothing if there's no content
        }
        
        const section_div = this.Helpers.create_element('div', { class_name: 'audit-section' });
        section_div.appendChild(this.Helpers.create_element('h2', { text_content: t(title_key) }));
        
        const content_element = this.Helpers.create_element('div', { class_name: ['audit-section-content', 'markdown-content'] });
        
        if (typeof marked !== 'undefined' && typeof this.Helpers.escape_html === 'function') {
            const renderer = new marked.Renderer();
            renderer.link = (href, title, text) => {
                const safe_href = this.Helpers.escape_html(href);
                const safe_text = this.Helpers.escape_html(text);
                return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
            };
            renderer.html = (html_token) => {
                const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof html_token.text === 'string')
                    ? html_token.text
                    : String(html_token || '');
                return this.Helpers.escape_html(text_to_escape);
            };
            // Use safe HTML sanitization for markdown content
            const parsed_markdown = marked.parse(String(content_data), { renderer: renderer, breaks: true, gfm: true });
            if (this.Helpers.sanitize_html) {
                content_element.innerHTML = this.Helpers.sanitize_html(parsed_markdown);
            } else {
                content_element.textContent = String(content_data);
            }
        } else {
            content_element.textContent = String(content_data);
        }
        
        section_div.appendChild(content_element);
        return section_div;
    },
    
    render(requirement_definition, sample, rule_file_metadata) {
        this.container_ref.innerHTML = '';
        
        const sections_to_render = [
            this.render_markdown_section('requirement_expected_observation', requirement_definition.expectedObservation),
            this.render_markdown_section('requirement_instructions', requirement_definition.instructions),
            this.render_markdown_section('requirement_exceptions', requirement_definition.exceptions),
            this.render_markdown_section('requirement_common_errors', requirement_definition.commonErrors),
            this.render_markdown_section('requirement_examples', requirement_definition.examples),
            this.render_markdown_section('requirement_tips', requirement_definition.tips)
        ];

        // Intentionally do not render content types section on requirement audit view
        
        sections_to_render.filter(Boolean).forEach(section => this.container_ref.appendChild(section));
    },
    
    destroy() {
        if (this.container_ref) this.container_ref.innerHTML = '';
        this.container_ref = null;
    }
};
