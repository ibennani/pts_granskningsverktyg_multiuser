import { marked } from '../utils/markdown.js';
import "../../css/components/audit_info_component.css";

export const AuditInfoComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
    },

    create_info_item(label_key, value, options = {}) {
        const { is_html = false, is_markdown = false } = options;
        const t = this.Translation.t;
        const item_div = this.Helpers.create_element('div', { class_name: 'info-item' });
        const strong = this.Helpers.create_element('strong', { text_content: t(label_key) });
        item_div.appendChild(strong);
        
        let value_container;
        if (is_markdown) {
            value_container = this.Helpers.create_element('div', { class_name: ['value', 'markdown-content'] });
        } else {
            value_container = this.Helpers.create_element('p', { class_name: 'value' });
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
    },

    render() {
        if (!this.root) return;
        this.root.innerHTML = '';
        
        const t = this.Translation.t;
        const current_state = this.getState();

        const info_panel = this.Helpers.create_element('div', { class_name: 'audit-info-panel' });

        const header_wrapper = this.Helpers.create_element('div', { class_name: 'panel-header-wrapper' });
        header_wrapper.appendChild(this.Helpers.create_element('h2', { 
            class_name: 'dashboard-panel__title',
            text_content: t('audit_info_title') 
        }));

        if (current_state.auditStatus === 'in_progress') {
            const edit_button = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'button-small', 'edit-info-button'],
                attributes: { 'aria-label': t('edit_audit_information') },
                html_content: `<span>${t('edit_button_label')}</span>` + this.Helpers.get_icon_svg('edit', ['currentColor'], 16)
            });
            edit_button.addEventListener('click', () => {
                this.router('edit_metadata');
            });
            header_wrapper.appendChild(edit_button);
        }

        info_panel.appendChild(header_wrapper);
        
        const md = current_state.auditMetadata || {};
        const rf_meta = current_state.ruleFileContent.metadata || {};
        const lang_code = this.Translation.get_current_language_code();

        if (md.caseNumber) {
            info_panel.appendChild(this.create_info_item('case_number', md.caseNumber));
        }

        // Actor is mandatory, so it's always shown.
        info_panel.appendChild(this.create_info_item('actor_name', md.actorName));

        if (md.actorLink) {
            const safe_link = this.Helpers.add_protocol_if_missing(md.actorLink);
            const link_html = `<a href="${this.Helpers.escape_html(safe_link)}" target="_blank" rel="noopener noreferrer">${this.Helpers.escape_html(md.actorLink)}</a>`;
            info_panel.appendChild(this.create_info_item('actor_link', link_html, { is_html: true }));
        }

        if (md.auditorName) {
            info_panel.appendChild(this.create_info_item('auditor_name', md.auditorName));
        }
        
        if (md.caseHandler) {
            info_panel.appendChild(this.create_info_item('case_handler', md.caseHandler));
        }

        info_panel.appendChild(this.create_info_item('rule_file_title', rf_meta.title));
        info_panel.appendChild(this.create_info_item('version_rulefile', rf_meta.version));
        info_panel.appendChild(this.create_info_item('status', t(`audit_status_${current_state.auditStatus}`)));
        info_panel.appendChild(this.create_info_item('start_time', this.Helpers.format_iso_to_local_datetime(current_state.startTime, lang_code)));
        if (current_state.endTime) {
            info_panel.appendChild(this.create_info_item('end_time', this.Helpers.format_iso_to_local_datetime(current_state.endTime, lang_code)));
        }
        
        if (md.internalComment) {
            let parsed_comment = md.internalComment;
            if (typeof marked !== 'undefined') {
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
                
                const singleLineComment = md.internalComment.replace(/(\r\n|\n|\r)/gm, " ");
                parsed_comment = marked.parse(singleLineComment, { 
                    renderer: renderer,
                    breaks: true,
                    gfm: true 
                });
                
                // Använd sanitize_html om tillgängligt för extra säkerhet
                if (this.Helpers.sanitize_html) {
                    parsed_comment = this.Helpers.sanitize_html(parsed_comment);
                }
            }
            info_panel.appendChild(this.create_info_item('internal_comment', parsed_comment, { is_markdown: true }));
        }

        this.root.appendChild(info_panel);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.Translation = null;
        this.Helpers = null;
    }
};
