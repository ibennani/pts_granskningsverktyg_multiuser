// js/components/requirement_audit/RequirementInfoSections.js

import { marked, auto_convert_code_like_to_codeblocks } from '../../utils/markdown.js';

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
            // Automatiskt konvertera kod-liknande text till kodblock för att bevara radbrytningar
            const processed_content = auto_convert_code_like_to_codeblocks(String(content_data));
            
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
            const parsed_markdown = marked.parse(processed_content, { renderer: renderer, breaks: true, gfm: true });
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
        
        // Support both old format (direct fields) and new format (infoBlocks)
        const has_info_blocks = requirement_definition.infoBlocks && typeof requirement_definition.infoBlocks === 'object';
        const block_order = rule_file_metadata?.blockOrders?.infoBlocks || [];
        
        if (has_info_blocks) {
            // New format: use infoBlocks with ordering from metadata.blockOrders.infoBlocks
            const info_blocks = requirement_definition.infoBlocks;
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
                
                // Parse markdown content
                if (typeof marked !== 'undefined' && typeof this.Helpers.escape_html === 'function') {
                    // Automatiskt konvertera kod-liknande text till kodblock för att bevara radbrytningar
                    const processed_text = auto_convert_code_like_to_codeblocks(String(block.text));
                    
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
                    const parsed_markdown = marked.parse(processed_text, { renderer: renderer, breaks: true, gfm: true });
                    if (this.Helpers.sanitize_html) {
                        content_element.innerHTML = this.Helpers.sanitize_html(parsed_markdown);
                    } else {
                        content_element.textContent = String(block.text);
                    }
                } else {
                    content_element.textContent = String(block.text);
                }
                
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
                this.container_ref.appendChild(section_div);
            });
        } else {
            // Old format: fallback to direct fields (for backward compatibility)
            const sections_to_render = [
                this.render_markdown_section('requirement_expected_observation', requirement_definition.expectedObservation),
                this.render_markdown_section('requirement_instructions', requirement_definition.instructions),
                this.render_markdown_section('requirement_exceptions', requirement_definition.exceptions),
                this.render_markdown_section('requirement_common_errors', requirement_definition.commonErrors),
                this.render_markdown_section('requirement_examples', requirement_definition.examples),
                this.render_markdown_section('requirement_tips', requirement_definition.tips)
            ];
            sections_to_render.filter(Boolean).forEach(section => this.container_ref.appendChild(section));
        }
    },
    
    destroy() {
        if (this.container_ref) this.container_ref.innerHTML = '';
        this.container_ref = null;
    }
};
