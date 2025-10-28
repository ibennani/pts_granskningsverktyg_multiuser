// js/components/requirement_audit/RequirementInfoSections.js

import { marked } from '../../utils/markdown.js';

export const RequirementInfoSections = (function () {
    'use-strict';
    
    let container_ref;
    
    // Dependencies
    let Translation_t;
    let Helpers_create_element;
    
    function assign_globals_once() {
        if (Translation_t && Helpers_create_element) return;
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
    }
    
    function init(_container) {
        assign_globals_once();
        container_ref = _container;
    }
    
    function render_markdown_section(title_key, content_data) {
        const t = Translation_t;
        if (!content_data || (typeof content_data === 'string' && !content_data.trim())) {
            return null; // Return nothing if there's no content
        }
        
        const section_div = Helpers_create_element('div', { class_name: 'audit-section' });
        section_div.appendChild(Helpers_create_element('h2', { text_content: t(title_key) }));
        
        const content_element = Helpers_create_element('div', { class_name: ['audit-section-content', 'markdown-content'] });
        
        if (typeof marked !== 'undefined' && typeof window.Helpers.escape_html === 'function') {
            const renderer = new marked.Renderer();
            renderer.link = (href, title, text) => {
                const safe_href = window.Helpers.escape_html(href);
                const safe_text = window.Helpers.escape_html(text);
                return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
            };
            renderer.html = (html_token) => {
                const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof html_token.text === 'string')
                    ? html_token.text
                    : String(html_token || '');
                return window.Helpers.escape_html(text_to_escape);
            };
            // Use safe HTML sanitization for markdown content
            const parsed_markdown = marked.parse(String(content_data), { renderer: renderer, breaks: true, gfm: true });
            if (window.Helpers.sanitize_html) {
                content_element.innerHTML = window.Helpers.sanitize_html(parsed_markdown);
            } else {
                content_element.textContent = String(content_data);
            }
        } else {
            content_element.textContent = String(content_data);
        }
        
        section_div.appendChild(content_element);
        return section_div;
    }
    
    function render(requirement_definition, sample, rule_file_metadata) {
        container_ref.innerHTML = '';
        const t = Translation_t;

        const sections_to_render = [
            render_markdown_section('requirement_expected_observation', requirement_definition.expectedObservation),
            render_markdown_section('requirement_instructions', requirement_definition.instructions),
            render_markdown_section('requirement_exceptions', requirement_definition.exceptions),
            render_markdown_section('requirement_common_errors', requirement_definition.commonErrors),
            render_markdown_section('requirement_examples', requirement_definition.examples),
            render_markdown_section('requirement_tips', requirement_definition.tips)
        ];

        // Intentionally do not render content types section on requirement audit view
        
        sections_to_render.filter(Boolean).forEach(section => container_ref.appendChild(section));
    }
    
    function destroy() {
        if (container_ref) container_ref.innerHTML = '';
    }

    return {
        init,
        render,
        destroy
    };
    
})();
