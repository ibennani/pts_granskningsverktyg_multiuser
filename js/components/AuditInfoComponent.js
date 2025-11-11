// js/components/AuditInfoComponent.js

import { marked } from '../utils/markdown.js';

export const AuditInfoComponent = (function () {
    'use-strict';

    const CSS_PATH = 'css/components/audit_info_component.css';
    let container_ref;
    let router_ref;
    let getState_ref;

    // Dependencies
    let Translation_t;
    let Helpers_create_element, Helpers_get_icon_svg, Helpers_format_iso_to_local_datetime, Helpers_escape_html, Helpers_load_css, Helpers_add_protocol_if_missing;

    async function init(_container, _router, _getState) {
        container_ref = _container;
        router_ref = _router;
        getState_ref = _getState;

        // Assign globals once
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        Helpers_get_icon_svg = window.Helpers?.get_icon_svg;
        Helpers_format_iso_to_local_datetime = window.Helpers?.format_iso_to_local_datetime;
        Helpers_escape_html = window.Helpers?.escape_html;
        Helpers_add_protocol_if_missing = window.Helpers?.add_protocol_if_missing;
        Helpers_load_css = window.Helpers?.load_css;

        await Helpers_load_css(CSS_PATH);
    }

    function create_info_item(label_key, value, options = {}) {
        const { is_html = false, is_markdown = false } = options;
        const t = Translation_t;
        const item_div = Helpers_create_element('div', { class_name: 'info-item' });
        const strong = Helpers_create_element('strong', { text_content: t(label_key) });
        item_div.appendChild(strong);
        
        let value_container;
        if (is_markdown) {
            value_container = Helpers_create_element('div', { class_name: ['value', 'markdown-content'] });
        } else {
            value_container = Helpers_create_element('p', { class_name: 'value' });
        }

        if (value || typeof value === 'number' || typeof value === 'boolean') {
            if (is_html || is_markdown) { 
                value_container.innerHTML = value;
            } else {
                value_container.textContent = String(value);
            }
        } else {
            value_container.textContent = '---';
            value_container.classList.add('text-muted');
        }
        item_div.appendChild(value_container);
        return item_div;
    }

    function render() {
        if (!container_ref) return;
        container_ref.innerHTML = '';
        
        const t = Translation_t;
        const current_state = getState_ref();

        const info_panel = Helpers_create_element('div', { class_name: 'audit-info-panel' });

        const header_wrapper = Helpers_create_element('div', { class_name: 'panel-header-wrapper' });
        header_wrapper.appendChild(Helpers_create_element('h2', { 
            class_name: 'dashboard-panel__title',
            text_content: t('audit_info_title') 
        }));

        if (current_state.auditStatus === 'in_progress') {
            const edit_button = Helpers_create_element('button', {
                class_name: ['button', 'button-default', 'button-small', 'edit-info-button'],
                attributes: { 'aria-label': t('edit_audit_information') },
                html_content: `<span>${t('edit_button_label')}</span>` + Helpers_get_icon_svg('edit', ['currentColor'], 16)
            });
            edit_button.addEventListener('click', () => {
                router_ref('edit_metadata');
            });
            header_wrapper.appendChild(edit_button);
        }

        info_panel.appendChild(header_wrapper);
        
        const md = current_state.auditMetadata || {};
        const rf_meta = current_state.ruleFileContent.metadata || {};
        const lang_code = window.Translation.get_current_language_code();

        // --- START OF CHANGE: Conditional Rendering Logic ---
        if (md.caseNumber) {
            info_panel.appendChild(create_info_item('case_number', md.caseNumber));
        }

        // Actor is mandatory, so it's always shown.
        info_panel.appendChild(create_info_item('actor_name', md.actorName));

        if (md.actorLink) {
            const safe_link = Helpers_add_protocol_if_missing(md.actorLink);
            const link_html = `<a href="${Helpers_escape_html(safe_link)}" target="_blank" rel="noopener noreferrer">${Helpers_escape_html(md.actorLink)}</a>`;
            info_panel.appendChild(create_info_item('actor_link', link_html, { is_html: true }));
        }

        if (md.auditorName) {
            info_panel.appendChild(create_info_item('auditor_name', md.auditorName));
        }
        
        if (md.caseHandler) {
            info_panel.appendChild(create_info_item('case_handler', md.caseHandler));
        }
        // --- END OF CHANGE ---

        info_panel.appendChild(create_info_item('rule_file_title', rf_meta.title));
        info_panel.appendChild(create_info_item('version_rulefile', rf_meta.version));
        info_panel.appendChild(create_info_item('status', t(`audit_status_${current_state.auditStatus}`)));
        info_panel.appendChild(create_info_item('start_time', Helpers_format_iso_to_local_datetime(current_state.startTime, lang_code)));
        if (current_state.endTime) {
            info_panel.appendChild(create_info_item('end_time', Helpers_format_iso_to_local_datetime(current_state.endTime, lang_code)));
        }
        
        if (md.internalComment) {
            let parsed_comment = md.internalComment;
            if (typeof marked !== 'undefined') {
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
                
                const singleLineComment = md.internalComment.replace(/(\r\n|\n|\r)/gm, " ");
                parsed_comment = marked.parse(singleLineComment, { 
                    renderer: renderer,
                    breaks: true,
                    gfm: true 
                });
                
                // Använd sanitize_html om tillgängligt för extra säkerhet
                if (window.Helpers.sanitize_html) {
                    parsed_comment = window.Helpers.sanitize_html(parsed_comment);
                }
            }
            info_panel.appendChild(create_info_item('internal_comment', parsed_comment, { is_markdown: true }));
        }

        container_ref.appendChild(info_panel);
    }

    function destroy() {
        if (container_ref) container_ref.innerHTML = '';
        container_ref = null;
        router_ref = null;
        getState_ref = null;
    }

    return { init, render, destroy };
})();
