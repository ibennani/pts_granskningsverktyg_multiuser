// js/components/requirement_audit/ChecklistHandler.js

import { marked } from '../../utils/markdown.js';

export const ChecklistHandler = {
    container_ref: null,
    on_status_change_callback: null,
    on_autosave_callback: null,

    Translation: null,
    Helpers: null,
    
    is_audit_locked: false,
    requirement_definition_ref: null,
    requirement_result_ref: null,

    is_dom_built: false,
    debounceTimerObservations: null,

    // --- HELPER FUNCTION ---
    _safe_parse_markdown_inline(markdown_string) {
        if (typeof marked === 'undefined' || !this.Helpers.escape_html) {
            return this.Helpers.escape_html(markdown_string);
        }

        const renderer = new marked.Renderer();
        renderer.link = (href, title, text) => {
            const safe_href = this.Helpers.escape_html(href);
            const safe_text = this.Helpers.escape_html(text);
            return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
        };
        // Escape raw HTML code so it shows as text, but respect markdown-generated HTML
        renderer.html = (html_token) => {
            const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof html_token.text === 'string')
                ? html_token.text
                : String(html_token || '');
            return this.Helpers.escape_html(text_to_escape);
        };

        const parsed_markdown = marked.parse(String(markdown_string || ''), { renderer, breaks: true, gfm: true });
        
        // Use sanitize_html if available for extra security
        if (this.Helpers.sanitize_html) {
            return this.Helpers.sanitize_html(parsed_markdown);
        }
        
        return parsed_markdown;
    },

    init(_container, _callbacks, options = {}) {
        this.container_ref = _container;
        this.on_status_change_callback = _callbacks.onStatusChange;
        this.on_autosave_callback = _callbacks.onAutosave;
        this.is_dom_built = false;

        const deps = options.deps || {};
        this.Translation = deps.Translation || window.Translation;
        this.Helpers = deps.Helpers || window.Helpers;

        // Bind handlers to this instance
        this.handle_checklist_click = this.handle_checklist_click.bind(this);
        this.handle_textarea_input = this.handle_textarea_input.bind(this);
        this.handle_textarea_blur = this.handle_textarea_blur.bind(this);
        this.handle_checklist_keydown = this.handle_checklist_keydown.bind(this);

        this.container_ref.addEventListener('click', this.handle_checklist_click);
        this.container_ref.addEventListener('input', this.handle_textarea_input);
        this.container_ref.addEventListener('blur', this.handle_textarea_blur, true);
        // Add keyboard support for accessibility
        this.container_ref.addEventListener('keydown', this.handle_checklist_keydown);
    },
    
    handle_checklist_click(event) {
        const target_button = event.target.closest('button[data-action]');
        if (!target_button) return;

        const action = target_button.dataset.action;
        const check_item_element = target_button.closest('.check-item[data-check-id]');
        const pc_item_element = target_button.closest('.pass-criterion-item[data-pc-id]');
        
        if (!check_item_element) return;
        const check_id = check_item_element.dataset.checkId;

        let change_info = { type: null, checkId: check_id };

        if (action === 'set-check-complies') {
            change_info.type = 'check_overall_status_change';
            change_info.newStatus = 'passed';
        } else if (action === 'set-check-not-complies') {
            change_info.type = 'check_overall_status_change';
            change_info.newStatus = 'not_applicable';
        } else if (pc_item_element) {
            const pc_id = pc_item_element.dataset.pcId;
            change_info.pcId = pc_id;
            if (action === 'set-pc-passed') {
                change_info.type = 'pc_status_change';
                change_info.newStatus = 'passed';
            } else if (action === 'set-pc-failed') {
                change_info.type = 'pc_status_change';
                change_info.newStatus = 'failed';
            }
        }
        
        if (change_info.type && this.on_status_change_callback) {
            this.on_status_change_callback(change_info);
        }
    },

    handle_checklist_keydown(event) {
        // Handle keyboard navigation for accessibility
        if (event.key === 'Enter' || event.key === ' ') {
            const target_button = event.target.closest('button[data-action]');
            if (!target_button) return;
            
            event.preventDefault();
            // Trigger the same action as click
            this.handle_checklist_click(event);
        }
    },
    
    handle_textarea_input(event) {
        const textarea = event.target;
        if (!textarea.classList.contains('pc-observation-detail-textarea')) return;
        
        const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
        const check_item = textarea.closest('.check-item[data-check-id]');
        if (pc_item && check_item) {
            const check_id = check_item.dataset.checkId;
            const pc_id = pc_item.dataset.pcId;
            
            // Debounce autosave 
            clearTimeout(this.debounceTimerObservations);
            this.debounceTimerObservations = setTimeout(() => {
                if (this.on_autosave_callback) {
                    this.on_autosave_callback({ 
                        type: 'pc_observation', 
                        checkId: check_id, 
                        pcId: pc_id, 
                        value: textarea.value 
                    });
                }
            }, 3000);
        }
    },

    handle_textarea_blur(event) {
        const textarea = event.target;
        if (!textarea.classList.contains('pc-observation-detail-textarea')) return;
        
        const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
        const check_item = textarea.closest('.check-item[data-check-id]');
        if (pc_item && check_item) {
            const check_id = check_item.dataset.checkId;
            const pc_id = pc_item.dataset.pcId;
            
            // Save immediately on blur (clearing the debounce timer)
            clearTimeout(this.debounceTimerObservations);
            if (this.on_autosave_callback) {
                this.on_autosave_callback({ 
                    type: 'pc_observation', 
                    checkId: check_id, 
                    pcId: pc_id, 
                    value: textarea.value 
                });
            }
        }
    },

    build_initial_dom() {
        const t = this.Translation.t;
        this.container_ref.innerHTML = '';

        if (!this.requirement_definition_ref?.checks?.length) {
            this.container_ref.appendChild(this.Helpers.create_element('p', { class_name: 'text-muted', text_content: t('no_checks_for_this_requirement') }));
            this.is_dom_built = true;
            return;
        }

        this.container_ref.appendChild(this.Helpers.create_element('h2', { text_content: t('checks_title') }));
        
        this.requirement_definition_ref.checks.forEach((check_definition, check_index) => {
            const check_wrapper = this.Helpers.create_element('div', { 
                class_name: 'check-item',
                attributes: {'data-check-id': check_definition.id }
            });

            const check_title_label = `${t('check_item_title')} ${check_index + 1}`;
            const condition_h3 = this.Helpers.create_element('h3', { 
                class_name: 'check-condition-title', 
                html_content: this.Helpers.escape_html(check_title_label) 
            });
            check_wrapper.appendChild(condition_h3);

            const condition_text_div = this.Helpers.create_element('div', { 
                class_name: ['check-condition-text','markdown-content'], 
                html_content: this._safe_parse_markdown_inline(check_definition.condition) 
            });
            check_wrapper.appendChild(condition_text_div);
            
            const actions_div = this.Helpers.create_element('div', { class_name: 'condition-actions' });
            const check_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle', [], 16) : '';
            const cancel_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('cancel', [], 16) : '';
            actions_div.append(
                this.Helpers.create_element('button', { 
                    class_name: ['button', 'button-success', 'button-small'],
                    attributes: { 'data-action': 'set-check-complies' },
                    html_content: `<span>${t('check_complies')}</span>${check_icon}`
                }),
                this.Helpers.create_element('button', {
                    class_name: ['button', 'button-danger', 'button-small'],
                    attributes: { 'data-action': 'set-check-not-complies' },
                    html_content: `<span>${t('check_does_not_comply')}</span>${cancel_icon}`
                })
            );
            check_wrapper.appendChild(actions_div);
            
            check_wrapper.appendChild(this.Helpers.create_element('p', { class_name: 'check-status-display' }));
            
            const pc_list = this.Helpers.create_element('ul', { class_name: 'pass-criteria-list' });
            (check_definition.passCriteria || []).forEach((pc_def, pc_index) => {
                const pc_item_li = this.Helpers.create_element('li', { 
                    class_name: 'pass-criterion-item', 
                    attributes: {'data-pc-id': pc_def.id }
                });

                const numbering = `${check_index + 1}.${pc_index + 1}`;
                const pc_title_div = this.Helpers.create_element('div', {
                    class_name: 'pass-criterion-title',
                    html_content: `<strong>${this.Helpers.escape_html(t('pass_criterion_label'))} ${this.Helpers.escape_html(numbering)}</strong>`
                });
                pc_item_li.appendChild(pc_title_div);

                const requirement_content_div = this.Helpers.create_element('div', { 
                    class_name: ['pass-criterion-requirement', 'markdown-content'],
                    html_content: this._safe_parse_markdown_inline(pc_def.requirement)
                });
                pc_item_li.appendChild(requirement_content_div);
                
                pc_item_li.appendChild(this.Helpers.create_element('div', { class_name: 'pass-criterion-status' }));
                
                const pc_actions_div = this.Helpers.create_element('div', { class_name: 'pass-criterion-actions' });
                const thumb_up_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('thumb_up', [], 16) : '';
                const thumb_down_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('thumb_down', [], 16) : '';
                pc_actions_div.append(
                    this.Helpers.create_element('button', {
                        class_name: ['button', 'button-success', 'button-small'],
                        attributes: { 'data-action': 'set-pc-passed' },
                        html_content: `<span>${t('pass_criterion_approved')}</span>${thumb_up_icon}`
                    }),
                    this.Helpers.create_element('button', {
                        class_name: ['button', 'button-danger', 'button-small'],
                        attributes: { 'data-action': 'set-pc-failed' },
                        html_content: `<span>${t('pass_criterion_failed')}</span>${thumb_down_icon}`
                    })
                );
                pc_item_li.appendChild(pc_actions_div);

                const observation_wrapper = this.Helpers.create_element('div', { class_name: 'pc-observation-detail-wrapper form-group' });
                const observation_label = this.Helpers.create_element('label', { 
                    attributes: { for: `pc-observation-${check_definition.id}-${pc_def.id}` }, 
                    text_content: t('pc_observation_detail_label') 
                });
                observation_wrapper.appendChild(observation_label);
                const observation_textarea = this.Helpers.create_element('textarea', {
                    id: `pc-observation-${check_definition.id}-${pc_def.id}`,
                    class_name: 'form-control pc-observation-detail-textarea',
                    attributes: { rows: '4' }
                });
                observation_wrapper.appendChild(observation_textarea);
                
                pc_item_li.appendChild(observation_wrapper);
                pc_list.appendChild(pc_item_li);
            });
            check_wrapper.appendChild(pc_list);

            check_wrapper.appendChild(this.Helpers.create_element('p', { class_name: 'text-muted compliance-info-text', style: 'font-style: italic;' }));
            
            this.container_ref.appendChild(check_wrapper);
        });

        this.is_dom_built = true;
    },

    update_dom() {
        const t = this.Translation.t;
        
        this.container_ref.querySelectorAll('.check-item[data-check-id]').forEach(check_wrapper => {
            const check_id = check_wrapper.dataset.checkId;
            const check_result_data = this.requirement_result_ref.checkResults[check_id];
            const calculated_check_status = check_result_data?.status || 'not_audited';
            const overall_manual_status = check_result_data?.overallStatus || 'not_audited';

            check_wrapper.className = `check-item status-${calculated_check_status}`;

            const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]');
            const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]');
            
            if (complies_btn && not_complies_btn) {
                complies_btn.classList.toggle('active', overall_manual_status === 'passed');
                not_complies_btn.classList.toggle('active', overall_manual_status === 'not_applicable');
                complies_btn.parentElement.style.display = this.is_audit_locked ? 'none' : 'flex';
            }
            
            const status_text_container = check_wrapper.querySelector('.check-status-display');
            status_text_container.innerHTML = '';
            const status_text = t(`audit_status_${calculated_check_status}`);
            const strong_element = this.Helpers.create_element('strong', { text_content: t('check_status') });
            status_text_container.appendChild(strong_element);
            status_text_container.appendChild(document.createTextNode(': '));
            const status_span = this.Helpers.create_element('span', { 
                class_name: `status-text status-${calculated_check_status}`, 
                text_content: status_text 
            });
            status_text_container.appendChild(status_span);
            
            const pc_list = check_wrapper.querySelector('.pass-criteria-list');
            const compliance_info_text = check_wrapper.querySelector('.compliance-info-text');

            const pc_list_was_hidden = pc_list.style.display === 'none';
            const compliance_was_hidden = compliance_info_text.style.display === 'none';

            pc_list.classList.remove('slide-down-in', 'slide-down-out');
            compliance_info_text.classList.remove('slide-down-in', 'slide-down-out');

            // Show/hide pass criteria
            if (overall_manual_status === 'passed' && pc_list.children.length > 0) {
                pc_list.style.display = '';
                if (pc_list_was_hidden) {
                    pc_list.classList.add('slide-down-in');
                }
            } else {
                if (!pc_list_was_hidden) {
                    pc_list.classList.add('slide-down-out');
                    setTimeout(() => {
                        pc_list.style.display = 'none';
                        pc_list.classList.remove('slide-down-out');
                    }, 500);
                } else {
                    pc_list.style.display = 'none';
                }
            }
            
            // Show/hide compliance info text
            if (overall_manual_status === 'not_applicable') {
                compliance_info_text.textContent = t('condition_not_met_criteria_auto_passed');
                compliance_info_text.style.display = '';
                if (compliance_was_hidden) {
                    compliance_info_text.classList.add('slide-down-in');
                }
            } else {
                if (!compliance_was_hidden) {
                    compliance_info_text.classList.add('slide-down-out');
                    setTimeout(() => {
                        compliance_info_text.style.display = 'none';
                        compliance_info_text.classList.remove('slide-down-out');
                    }, 500);
                } else {
                    compliance_info_text.style.display = 'none';
                }
            }

            check_wrapper.querySelectorAll('.pass-criterion-item[data-pc-id]').forEach(pc_item_li => {
                const pc_id = pc_item_li.dataset.pcId;
                const pc_data = check_result_data?.passCriteria[pc_id] || { status: 'not_audited', observationDetail: '' };
                const current_pc_status = pc_data.status;

                const pc_status_text_container = pc_item_li.querySelector('.pass-criterion-status');
                pc_status_text_container.innerHTML = '';
                const pc_status_text = t(`audit_status_${current_pc_status}`);
                const pc_strong_element = this.Helpers.create_element('strong', { text_content: t('status') });
                pc_status_text_container.appendChild(pc_strong_element);
                pc_status_text_container.appendChild(document.createTextNode(': '));
                const pc_status_span = this.Helpers.create_element('span', { 
                    class_name: `status-text status-${current_pc_status}`, 
                    text_content: pc_status_text 
                });
                pc_status_text_container.appendChild(pc_status_span);

                const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]');
                const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]');

                if (passed_btn && failed_btn) {
                    passed_btn.classList.toggle('active', current_pc_status === 'passed');
                    failed_btn.classList.toggle('active', current_pc_status === 'failed');
                    passed_btn.parentElement.style.display = this.is_audit_locked ? 'none' : 'flex';
                }

                const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper');
                const observation_textarea = observation_wrapper.querySelector('textarea');

                const was_hidden = observation_wrapper.hidden;
                
                observation_wrapper.classList.remove('slide-down-in', 'slide-down-out');
                
                // Show/hide observation field
                if (current_pc_status === 'failed') {
                    observation_wrapper.hidden = false;
                    if (was_hidden) {
                        observation_wrapper.classList.add('slide-down-in');
                    }
                    
                    if (was_hidden && !this.is_audit_locked) {
                        setTimeout(() => {
                            if (!window.focusProtectionActive && !window.customFocusApplied) {
                                observation_textarea.focus();
                            }
                        }, 500);
                    }
                } else {
                    if (!was_hidden) {
                        observation_wrapper.classList.add('slide-down-out');
                        setTimeout(() => {
                            observation_wrapper.hidden = true;
                            observation_wrapper.classList.remove('slide-down-out');
                        }, 500);
                    } else {
                        observation_wrapper.hidden = true;
                    }
                }
                
                observation_textarea.readOnly = this.is_audit_locked;
                if (observation_textarea.value !== (pc_data.observationDetail || '')) {
                    observation_textarea.value = pc_data.observationDetail || '';
                }
                if (this.Helpers?.init_auto_resize_for_textarea) {
                    this.Helpers.init_auto_resize_for_textarea(observation_textarea);
                }
            });
        });
    },

    render(requirement_definition, requirement_result, locked_status) {
        this.requirement_definition_ref = requirement_definition;
        this.requirement_result_ref = requirement_result;
        this.is_audit_locked = locked_status;

        if (!this.is_dom_built) {
            this.build_initial_dom();
        }

        this.update_dom();
    },

    destroy() {
        clearTimeout(this.debounceTimerObservations);
        if (this.container_ref) {
            this.container_ref.removeEventListener('click', this.handle_checklist_click);
            this.container_ref.removeEventListener('input', this.handle_textarea_input);
            this.container_ref.removeEventListener('blur', this.handle_textarea_blur, true);
            this.container_ref.removeEventListener('keydown', this.handle_checklist_keydown);
            this.container_ref.innerHTML = '';
        }
        this.is_dom_built = false;
        this.container_ref = null;
    }
};
