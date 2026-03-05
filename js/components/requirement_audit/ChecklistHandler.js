// js/components/requirement_audit/ChecklistHandler.js

import { get_current_user_name } from '../../utils/helpers.js';
import { marked } from '../../utils/markdown.js';

export const ChecklistHandler = {
    container_ref: null,
    on_status_change_callback: null,
    on_observation_change_callback: null,
    on_stuck_description_saved_callback: null,

    Translation: null,
    Helpers: null,
    
    is_audit_locked: false,
    requirement_definition_ref: null,
    requirement_result_ref: null,

    is_dom_built: false,
    last_language_code: null,

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

    _get_plain_text_from_html(html_string) {
        const div = document.createElement('div');
        div.innerHTML = html_string || '';
        return (div.textContent || div.innerText || '').trim();
    },

    init(_container, _callbacks, options = {}) {
        this.container_ref = _container;
        this.on_status_change_callback = _callbacks.onStatusChange;
        this.on_observation_change_callback = _callbacks.onObservationChange;
        this.on_observation_change_immediate_callback = _callbacks.onObservationChangeImmediate || null;
        this.on_stuck_description_saved_callback = _callbacks.onStuckDescriptionSaved || null;
        this.is_dom_built = false;

        const deps = options.deps || {};
        this.Translation = deps.Translation || window.Translation;
        this.Helpers = deps.Helpers || window.Helpers;
        this.get_observations_from_other_samples = options.getObservationsFromOtherSamples || (() => []);

        // Bind handlers to this instance
        this.handle_checklist_click = this.handle_checklist_click.bind(this);
        this.handle_textarea_input = this.handle_textarea_input.bind(this);
        this.handle_checklist_keydown = this.handle_checklist_keydown.bind(this);
        this.handle_attach_media_click = this.handle_attach_media_click.bind(this);
        this.handle_stuck_click = this.handle_stuck_click.bind(this);
        this.handle_copy_observation_click = this.handle_copy_observation_click.bind(this);

        this.container_ref.addEventListener('click', this.handle_checklist_click);
        this.container_ref.addEventListener('input', this.handle_textarea_input);
        // Add keyboard support for accessibility
        this.container_ref.addEventListener('keydown', this.handle_checklist_keydown);
    },
    
    handle_checklist_click(event) {
        const attach_btn = event.target.closest('button[data-action="attach-media"]');
        if (attach_btn) {
            this.handle_attach_media_click(event, attach_btn);
            return;
        }

        const stuck_btn = event.target.closest('button[data-action="stuck"]');
        if (stuck_btn) {
            this.handle_stuck_click(event, stuck_btn);
            return;
        }

        const copy_obs_btn = event.target.closest('button[data-action="copy-observation"]');
        if (copy_obs_btn) {
            this.handle_copy_observation_click(event, copy_obs_btn);
            return;
        }

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

    handle_attach_media_click(event, attach_btn) {
        event.preventDefault();
        const pc_item = attach_btn.closest('.pass-criterion-item[data-pc-id]');
        const check_item = attach_btn.closest('.check-item[data-check-id]');
        if (!pc_item || !check_item) return;

        const pc_id = pc_item.dataset.pcId;
        const check_id = check_item.dataset.checkId;

        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const t = this.Translation.t;
        ModalComponent.show(
            {
                h1_text: t('attach_media_modal_h1'),
                message_text: t('attach_media_modal_intro')
            },
            (container, modal) => {
                const form_group = this.Helpers.create_element('div', { class_name: 'form-group' });
                const label = this.Helpers.create_element('label', {
                    attributes: { for: 'attach-media-filenames' },
                    text_content: t('attach_media_modal_filename_label')
                });
                form_group.appendChild(label);

                const existing_filenames = this.requirement_result_ref?.checkResults?.[check_id]?.passCriteria?.[pc_id]?.attachedMediaFilenames;
                const initial_text = Array.isArray(existing_filenames) ? existing_filenames.join('\n') : '';
                const textarea = this.Helpers.create_element('textarea', {
                    id: 'attach-media-filenames',
                    class_name: 'form-control',
                    attributes: { rows: '3' }
                });
                textarea.value = initial_text;
                if (this.Helpers?.init_auto_resize_for_textarea) {
                    this.Helpers.init_auto_resize_for_textarea(textarea);
                }
                form_group.appendChild(textarea);
                container.appendChild(form_group);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-attach-media-actions' });
                const save_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('attach_media_modal_save')
                });
                save_btn.addEventListener('click', () => {
                    const filenames = textarea.value
                        .split('\n')
                        .map(s => s.trim())
                        .filter(Boolean);
                    const check_result = this.requirement_result_ref?.checkResults?.[check_id];
                    if (check_result?.passCriteria?.[pc_id]) {
                        check_result.passCriteria[pc_id].attachedMediaFilenames = filenames;
                        if (this.on_observation_change_callback) {
                            this.on_observation_change_callback();
                        }
                    }
                    modal.close(attach_btn);
                });
                const discard_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('attach_media_modal_discard')
                });
                discard_btn.addEventListener('click', () => {
                    modal.close(attach_btn);
                });
                actions_wrapper.appendChild(save_btn);
                actions_wrapper.appendChild(discard_btn);
                container.appendChild(actions_wrapper);
            }
        );
    },

    handle_stuck_click(event, stuck_btn) {
        event.preventDefault();
        if (!this.requirement_result_ref) return;

        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const t = this.Translation.t;
        const existing_description = (typeof this.requirement_result_ref.stuckProblemDescription === 'string')
            ? this.requirement_result_ref.stuckProblemDescription
            : '';

        ModalComponent.show(
            {
                h1_text: t('stuck_modal_h1'),
                message_text: t('stuck_modal_intro')
            },
            (container, modal) => {
                const form_group = this.Helpers.create_element('div', { class_name: 'form-group' });
                const label = this.Helpers.create_element('label', {
                    attributes: { for: 'stuck-problem-description' },
                    text_content: t('stuck_modal_label')
                });
                form_group.appendChild(label);

                const textarea = this.Helpers.create_element('textarea', {
                    id: 'stuck-problem-description',
                    class_name: 'form-control',
                    attributes: { rows: '5' }
                });
                textarea.value = existing_description;
                if (this.Helpers?.init_auto_resize_for_textarea) {
                    this.Helpers.init_auto_resize_for_textarea(textarea);
                }
                form_group.appendChild(textarea);
                container.appendChild(form_group);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-attach-media-actions' });
                const save_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('stuck_modal_save')
                });
                save_btn.addEventListener('click', () => {
                    const raw = textarea.value || '';
                    const description = this.Helpers?.trim_textarea_preserve_lines
                        ? this.Helpers.trim_textarea_preserve_lines(raw)
                        : raw.trim();
                    this.requirement_result_ref.stuckProblemDescription = description;
                    this.requirement_result_ref.lastStatusUpdate = this.Helpers?.get_current_iso_datetime_utc?.() || new Date().toISOString();
                    this.requirement_result_ref.lastStatusUpdateBy = get_current_user_name();
                    if (window.__GV_DEBUG_STUCK_SYNC__) {
                        console.log('[GV-Debug] Modal: Spara klickad, textlängd:', description.length);
                    }
                    if (this.on_stuck_description_saved_callback) {
                        this.on_stuck_description_saved_callback();
                    } else if (this.on_observation_change_callback) {
                        this.on_observation_change_callback();
                    }
                    modal.close(stuck_btn);
                });
                const discard_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('stuck_modal_discard')
                });
                discard_btn.addEventListener('click', () => {
                    modal.close(stuck_btn);
                });
                actions_wrapper.appendChild(save_btn);
                actions_wrapper.appendChild(discard_btn);
                if ((existing_description || '').trim() !== '') {
                    const problem_solved_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'modal-action-right'],
                        attributes: { type: 'button' },
                        text_content: t('stuck_modal_problem_solved')
                    });
                    problem_solved_btn.addEventListener('click', () => {
                        this.requirement_result_ref.stuckProblemDescription = '';
                        this.requirement_result_ref.lastStatusUpdate = this.Helpers?.get_current_iso_datetime_utc?.() || new Date().toISOString();
                        this.requirement_result_ref.lastStatusUpdateBy = get_current_user_name();
                        if (window.__GV_DEBUG_STUCK_SYNC__) {
                            console.log('[GV-Debug] Modal: Problemet är löst klickad');
                        }
                        if (this.on_stuck_description_saved_callback) {
                            this.on_stuck_description_saved_callback();
                        } else if (this.on_observation_change_callback) {
                            this.on_observation_change_callback();
                        }
                        modal.close(stuck_btn);
                    });
                    actions_wrapper.appendChild(problem_solved_btn);
                }
                container.appendChild(actions_wrapper);
            }
        );
    },

    handle_copy_observation_click(event, copy_btn) {
        event.preventDefault();
        const pc_item = copy_btn.closest('.pass-criterion-item[data-pc-id]');
        const check_item = copy_btn.closest('.check-item[data-check-id]');
        if (!pc_item || !check_item) return;

        const pc_id = pc_item.dataset.pcId;
        const check_id = check_item.dataset.checkId;
        const observations = this.get_observations_from_other_samples(check_id, pc_id);

        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const t = this.Translation.t;

        if (observations.length === 0) {
            ModalComponent.show(
                {
                    h1_text: t('copy_observation_modal_title'),
                    message_text: t('copy_observation_modal_empty')
                },
                (container, modal) => {
                    const close_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-default'],
                        attributes: { type: 'button' },
                        text_content: t('copy_observation_modal_close')
                    });
                    close_btn.addEventListener('click', () => modal.close(copy_btn));
                    container.appendChild(close_btn);
                }
            );
            return;
        }

        ModalComponent.show(
            {
                h1_text: t('copy_observation_modal_title'),
                message_text: ''
            },
            (container, modal) => {
                const fieldset = this.Helpers.create_element('fieldset', {
                    class_name: 'copy-observation-radio-group',
                    attributes: { 'aria-label': t('copy_observation_modal_title') }
                });
                const radio_name = `copy-observation-${check_id}-${pc_id}`;
                observations.forEach((text, index) => {
                    const id = `copy-obs-${check_id}-${pc_id}-${index}`;
                    const label = this.Helpers.create_element('label', {
                        class_name: 'copy-observation-radio-option',
                        attributes: { for: id }
                    });
                    const radio = this.Helpers.create_element('input', {
                        attributes: {
                            type: 'radio',
                            name: radio_name,
                            id,
                            value: String(index),
                            checked: index === 0
                        }
                    });
                    const text_span = this.Helpers.create_element('span', { class_name: 'copy-observation-radio-text', text_content: text });
                    label.appendChild(radio);
                    label.appendChild(text_span);
                    fieldset.appendChild(label);
                });
                container.appendChild(fieldset);

                const actions_wrapper = this.Helpers.create_element('div', { class_name: 'modal-copy-observation-actions' });
                const paste_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    attributes: { type: 'button' },
                    text_content: t('copy_observation_modal_paste')
                });
                paste_btn.addEventListener('click', () => {
                    const selected = container.querySelector(`input[name="${CSS.escape(radio_name)}"]:checked`);
                    if (selected) {
                        const idx = parseInt(selected.value, 10);
                        const text_to_paste = observations[idx];
                        const textarea_id = `pc-observation-${check_id}-${pc_id}`;
                        const textarea = this.container_ref.querySelector(`#${CSS.escape(textarea_id)}`);
                        if (textarea && typeof text_to_paste === 'string') {
                            const check_result = this.requirement_result_ref?.checkResults?.[check_id];
                            if (check_result?.passCriteria?.[pc_id]) {
                                check_result.passCriteria[pc_id].observationDetail = text_to_paste;
                                const ts = this.Helpers?.get_current_iso_datetime_utc
                                    ? this.Helpers.get_current_iso_datetime_utc()
                                    : new Date().toISOString();
                                check_result.passCriteria[pc_id].timestamp = ts;
                                check_result.passCriteria[pc_id].updatedBy = get_current_user_name();
                            }
                            textarea.value = text_to_paste;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                            if (this.on_observation_change_immediate_callback) {
                                this.on_observation_change_immediate_callback();
                            } else if (this.on_observation_change_callback) {
                                this.on_observation_change_callback();
                            }
                        }
                    }
                    modal.close(copy_btn);
                });
                const close_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('copy_observation_modal_close')
                });
                close_btn.addEventListener('click', () => modal.close(copy_btn));
                actions_wrapper.appendChild(paste_btn);
                actions_wrapper.appendChild(close_btn);
                container.appendChild(actions_wrapper);
            }
        );
    },
    
    handle_textarea_input(event) {
        const textarea = event.target;
        if (!textarea.classList.contains('pc-observation-detail-textarea')) return;
        
        const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
        const check_item = textarea.closest('.check-item[data-check-id]');
        if (pc_item && check_item && this.requirement_result_ref?.checkResults) {
            const check_id = check_item.dataset.checkId;
            const pc_id = pc_item.dataset.pcId;
            const check_result = this.requirement_result_ref.checkResults[check_id];
            if (check_result?.passCriteria?.[pc_id]) {
                check_result.passCriteria[pc_id].observationDetail = textarea.value;
                const ts = this.Helpers?.get_current_iso_datetime_utc
                    ? this.Helpers.get_current_iso_datetime_utc()
                    : new Date().toISOString();
                check_result.passCriteria[pc_id].timestamp = ts;
                check_result.passCriteria[pc_id].updatedBy = get_current_user_name();
            }
            if (event.type === 'input' && this.on_observation_change_callback) {
                this.on_observation_change_callback();
            }
        }
    },

    _create_update_badge(type) {
        const t = this.Translation.t;
        const is_new = type === 'new';
        const label = is_new ? t('pass_criterion_badge_new') : t('pass_criterion_badge_updated');
        const icon_svg = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
        const span = this.Helpers.create_element('span', {
            class_name: `pass-criterion-update-badge pass-criterion-update-badge--${type}`,
            attributes: { 'aria-hidden': 'true' }
        });
        if (icon_svg) {
            const icon_wrapper = document.createElement('span');
            icon_wrapper.setAttribute('aria-hidden', 'true');
            icon_wrapper.innerHTML = icon_svg;
            span.appendChild(icon_wrapper);
        }
        span.appendChild(document.createTextNode(' ' + label));
        return span;
    },

    build_initial_dom() {
        const t = this.Translation.t;
        const details = this.requirement_update_details;
        this.container_ref.innerHTML = '';

        if (!this.requirement_definition_ref?.checks?.length) {
            this.container_ref.appendChild(this.Helpers.create_element('p', { class_name: 'text-muted', text_content: t('no_checks_for_this_requirement') }));
            this.is_dom_built = true;
            return;
        }

        const checks_region = this.Helpers.create_element('section', {
            class_name: 'checks-container',
            attributes: {
                role: 'region',
                'aria-label': t('checks_landmark_label')
            }
        });

        const checks_header_row = this.Helpers.create_element('div', { class_name: 'checks-header-row' });
        const checks_h2 = this.Helpers.create_element('h2', { text_content: t('checks_title') });
        const checks_header_actions = this.Helpers.create_element('div', { class_name: 'checks-header-actions' });
        checks_header_row.appendChild(checks_h2);
        checks_header_row.appendChild(checks_header_actions);
        checks_region.appendChild(checks_header_row);

        this.requirement_definition_ref.checks.forEach((check_definition, check_index) => {
            const check_id = check_definition?.id ?? check_definition?.key;
            const check_wrapper = this.Helpers.create_element('div', { 
                class_name: 'check-item',
                attributes: {'data-check-id': check_id }
            });

            const check_title_label = `${t('check_item_title')} ${check_index + 1}`;
            const condition_h3 = this.Helpers.create_element('h3', { class_name: 'check-condition-title' });
            condition_h3.textContent = check_title_label;
            if (check_id && details?.addedChecks?.includes(check_id)) {
                condition_h3.appendChild(document.createTextNode(' '));
                condition_h3.appendChild(this._create_update_badge('new'));
            }
            check_wrapper.appendChild(condition_h3);

            const condition_text_div = this.Helpers.create_element('div', { 
                class_name: ['check-condition-text','markdown-content'], 
                html_content: this._safe_parse_markdown_inline(check_definition.condition) 
            });
            check_wrapper.appendChild(condition_text_div);
            
            const actions_div = this.Helpers.create_element('div', {
                class_name: 'condition-actions'
            });
            const check_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle', [], 16) : '';
            const cancel_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('cancel', [], 16) : '';
            actions_div.append(
                this.Helpers.create_element('button', {
                    class_name: ['button', 'button-success', 'button-small'],
                    attributes: { 'data-action': 'set-check-complies', 'aria-pressed': 'false' },
                    html_content: `<span>${t('check_complies')}</span>${check_icon}`
                }),
                this.Helpers.create_element('button', {
                    class_name: ['button', 'button-danger', 'button-small'],
                    attributes: { 'data-action': 'set-check-not-complies', 'aria-pressed': 'false' },
                    html_content: `<span>${t('check_does_not_comply')}</span>${cancel_icon}`
                })
            );
            check_wrapper.appendChild(actions_div);
            
            check_wrapper.appendChild(this.Helpers.create_element('p', { class_name: 'check-status-display', attributes: { 'aria-hidden': 'true' } }));
            
            const pc_list = this.Helpers.create_element('ul', { class_name: 'pass-criteria-list' });
            (check_definition.passCriteria || []).forEach((pc_def, pc_index) => {
                const pc_id = pc_def?.id ?? pc_def?.key;
                const pc_item_li = this.Helpers.create_element('li', { 
                    class_name: 'pass-criterion-item', 
                    attributes: {'data-pc-id': pc_id }
                });

                const numbering = `${check_index + 1}.${pc_index + 1}`;
                const pc_title_h4 = this.Helpers.create_element('h4', { class_name: 'pass-criterion-title' });
                const strong = this.Helpers.create_element('strong', {
                    text_content: `${t('pass_criterion_label')} ${numbering}`
                });
                pc_title_h4.appendChild(strong);
                const in_added = check_id && pc_id && details?.added?.some(e => e.checkId === check_id && e.passCriterionId === pc_id);
                const in_updated = check_id && pc_id && details?.updated?.some(e => e.checkId === check_id && e.passCriterionId === pc_id);
                if (in_added) {
                    pc_title_h4.appendChild(document.createTextNode(' '));
                    pc_title_h4.appendChild(this._create_update_badge('new'));
                } else if (in_updated) {
                    pc_title_h4.appendChild(document.createTextNode(' '));
                    pc_title_h4.appendChild(this._create_update_badge('updated'));
                }
                pc_item_li.appendChild(pc_title_h4);

                const requirement_content_div = this.Helpers.create_element('div', { 
                    class_name: ['pass-criterion-requirement', 'markdown-content'],
                    html_content: this._safe_parse_markdown_inline(pc_def.requirement)
                });
                pc_item_li.appendChild(requirement_content_div);
                
                pc_item_li.appendChild(this.Helpers.create_element('div', {
                    class_name: 'pass-criterion-status',
                    attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' }
                }));

                const pc_actions_div = this.Helpers.create_element('div', {
                    class_name: 'pass-criterion-actions'
                });
                const thumb_up_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('thumb_up', [], 16) : '';
                const thumb_down_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('thumb_down', [], 16) : '';
                pc_actions_div.append(
                    this.Helpers.create_element('button', {
                        class_name: ['button', 'button-success', 'button-small'],
                        attributes: { 'data-action': 'set-pc-passed', 'aria-pressed': 'false' },
                        html_content: `<span>${t('pass_criterion_approved')}</span>${thumb_up_icon}`
                    }),
                    this.Helpers.create_element('button', {
                        class_name: ['button', 'button-danger', 'button-small'],
                        attributes: { 'data-action': 'set-pc-failed', 'aria-pressed': 'false' },
                        html_content: `<span>${t('pass_criterion_failed')}</span>${thumb_down_icon}`
                    })
                );
                pc_item_li.appendChild(pc_actions_div);

                const observation_wrapper = this.Helpers.create_element('div', { class_name: 'pc-observation-detail-wrapper form-group' });
                const observation_label = this.Helpers.create_element('label', { 
                    attributes: { for: `pc-observation-${check_id}-${pc_id}` }, 
                    text_content: t('pc_observation_detail_label') 
                });
                observation_wrapper.appendChild(observation_label);
                const observation_textarea = this.Helpers.create_element('textarea', {
                    id: `pc-observation-${check_id}-${pc_id}`,
                    class_name: 'form-control pc-observation-detail-textarea',
                    attributes: { rows: '4' }
                });
                observation_wrapper.appendChild(observation_textarea);

                const attach_media_row = this.Helpers.create_element('div', { class_name: 'pc-attach-media-row' });
                const copy_observation_row = this.Helpers.create_element('div', { class_name: 'pc-copy-observation-row', attributes: { hidden: 'hidden' } });
                const copy_observation_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    attributes: {
                        'data-action': 'copy-observation',
                        'data-check-id': check_id,
                        'data-pc-id': pc_id,
                        type: 'button',
                        'aria-label': t('copy_observation_from_other_button')
                    },
                    text_content: t('copy_observation_from_other_button')
                });
                copy_observation_row.appendChild(copy_observation_btn);
                attach_media_row.appendChild(copy_observation_row);
                const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
                const requirement_plain = this._get_plain_text_from_html(
                    this._safe_parse_markdown_inline(pc_def.requirement)
                );
                const pc_result = this.requirement_result_ref?.checkResults?.[check_id]?.passCriteria?.[pc_id];
                const attached_filenames = Array.isArray(pc_result?.attachedMediaFilenames)
                    ? pc_result.attachedMediaFilenames.filter(f => f && String(f).trim())
                    : [];
                const attached_count = attached_filenames.length;
                const attach_btn_label = attached_count > 0
                    ? t('edit_attached_media_button', { count: attached_count })
                    : t('attach_media_button');
                const attach_aria_label = `${attach_btn_label} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
                const image_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('image', ['currentColor'], 16) : '';
                const video_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('videocam', ['currentColor'], 16) : '';
                const attach_icons_html = (image_icon || video_icon)
                    ? `<span class="attach-media-button-icons" aria-hidden="true">${image_icon}${video_icon}</span>`
                    : '';
                const attach_media_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small'],
                    attributes: {
                        'data-action': 'attach-media',
                        'data-check-id': check_id,
                        'data-pc-id': pc_id,
                        type: 'button',
                        'aria-label': attach_aria_label
                    },
                    html_content: `<span>${this.Helpers.escape_html(attach_btn_label)}</span>${attach_icons_html}`
                });
                attach_media_row.appendChild(attach_media_btn);

                observation_wrapper.appendChild(attach_media_row);

                const is_first_criterion = check_index === 0 && pc_index === 0;
                if (is_first_criterion) {
                    const has_stuck_content = (this.requirement_result_ref?.stuckProblemDescription || '').trim() !== '';
                    const stuck_aria_label = has_stuck_content
                        ? `${t('stuck_button')} ${t('stuck_button_has_content')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`
                        : `${t('stuck_button')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
                    const warning_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('warning', ['currentColor'], 16) : '';
                    const indicator_html = has_stuck_content
                        ? ` <span class="stuck-button-indicator">${this.Helpers.escape_html(t('stuck_button_has_content'))}</span>`
                        : '';
                    const stuck_btn = this.Helpers.create_element('button', {
                        class_name: ['button', 'button-default', 'button-small', 'stuck-button', ...(has_stuck_content ? ['stuck-button--has-content'] : [])],
                        attributes: {
                            'data-action': 'stuck',
                            'data-check-id': check_id,
                            'data-pc-id': pc_id,
                            type: 'button',
                            'aria-label': stuck_aria_label
                        },
                        html_content: `<span>${this.Helpers.escape_html(t('stuck_button'))}${indicator_html}</span>${warning_icon ? `<span class="stuck-button-icon" aria-hidden="true">${warning_icon}</span>` : ''}`
                    });
                    checks_header_actions.appendChild(stuck_btn);
                }

                pc_item_li.appendChild(observation_wrapper);
                pc_list.appendChild(pc_item_li);
            });
            check_wrapper.appendChild(pc_list);

            check_wrapper.appendChild(this.Helpers.create_element('p', { class_name: 'text-muted compliance-info-text', style: 'font-style: italic;' }));
            
            checks_region.appendChild(check_wrapper);
        });

        this.container_ref.appendChild(checks_region);

        this.is_dom_built = true;
    },

    update_dom() {
        const t = this.Translation.t;
        
        this.container_ref.querySelectorAll('.check-item[data-check-id]').forEach(check_wrapper => {
            const check_id = check_wrapper.dataset.checkId;
            const check_result_data = this.requirement_result_ref.checkResults?.[check_id]
                ?? this.requirement_result_ref.checkResults?.[String(check_id)];
            const calculated_check_status = check_result_data?.status || 'not_audited';
            const overall_manual_status = check_result_data?.overallStatus || 'not_audited';

            check_wrapper.className = `check-item status-${calculated_check_status}`;

            const complies_btn = check_wrapper.querySelector('button[data-action="set-check-complies"]');
            const not_complies_btn = check_wrapper.querySelector('button[data-action="set-check-not-complies"]');
            
            if (complies_btn && not_complies_btn) {
                complies_btn.classList.toggle('active', overall_manual_status === 'passed');
                not_complies_btn.classList.toggle('active', overall_manual_status === 'not_applicable');
                complies_btn.setAttribute('aria-pressed', overall_manual_status === 'passed' ? 'true' : 'false');
                not_complies_btn.setAttribute('aria-pressed', overall_manual_status === 'not_applicable' ? 'true' : 'false');
                complies_btn.parentElement.style.display = this.is_audit_locked ? 'none' : 'flex';
            }
            
            const condition_h3 = check_wrapper.querySelector('.check-condition-title');
            const status_text = t(`audit_status_${calculated_check_status}`);
            const title_text = condition_h3.textContent.trim();
            condition_h3.setAttribute('aria-label', `${title_text}. ${status_text.toLowerCase()}`);

            const status_text_container = check_wrapper.querySelector('.check-status-display');
            status_text_container.innerHTML = '';
            status_text_container.setAttribute('aria-hidden', 'true');
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

            pc_list.style.display = (overall_manual_status === 'passed' && pc_list.children.length > 0) ? '' : 'none';
            if (overall_manual_status === 'not_applicable') {
                compliance_info_text.textContent = t('condition_not_met_criteria_auto_passed');
                compliance_info_text.style.display = '';
            } else {
                compliance_info_text.style.display = 'none';
            }

            check_wrapper.querySelectorAll('.pass-criterion-item[data-pc-id]').forEach(pc_item_li => {
                const pc_id = pc_item_li.dataset.pcId;
                const pc_data = check_result_data?.passCriteria?.[pc_id] ?? check_result_data?.passCriteria?.[String(pc_id)] ?? { status: 'not_audited', observationDetail: '' };
                const current_pc_status = pc_data.status;

                const pc_status_text_container = pc_item_li.querySelector('.pass-criterion-status');
                pc_status_text_container.innerHTML = '';
                pc_status_text_container.setAttribute('aria-hidden', 'true');
                const pc_status_text = t(`audit_status_${current_pc_status}`);
                const pc_strong_element = this.Helpers.create_element('strong', { text_content: t('status') });
                pc_status_text_container.appendChild(pc_strong_element);
                pc_status_text_container.appendChild(document.createTextNode(': '));
                const pc_status_span = this.Helpers.create_element('span', { 
                    class_name: `status-text status-${current_pc_status}`, 
                    text_content: pc_status_text 
                });
                pc_status_text_container.appendChild(pc_status_span);

                const pc_title_h4 = pc_item_li.querySelector('.pass-criterion-title');
                if (pc_title_h4) {
                    const check_def = this.requirement_definition_ref?.checks?.find(c => (c?.id || c?.key) === check_id);
                    const pc_def = check_def?.passCriteria?.find(p => (p?.id || p?.key) === pc_id);
                    const check_idx = check_def ? (this.requirement_definition_ref.checks?.indexOf(check_def) ?? 0) : 0;
                    const pc_idx = pc_def ? (check_def?.passCriteria?.indexOf(pc_def) ?? 0) : 0;
                    const numbering = `${check_idx + 1}.${pc_idx + 1}`;
                    const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
                    pc_title_h4.setAttribute('aria-label', `${criterion_title}. ${pc_status_text}`);
                }

                const passed_btn = pc_item_li.querySelector('button[data-action="set-pc-passed"]');
                const failed_btn = pc_item_li.querySelector('button[data-action="set-pc-failed"]');

                if (passed_btn && failed_btn) {
                    passed_btn.classList.toggle('active', current_pc_status === 'passed');
                    failed_btn.classList.toggle('active', current_pc_status === 'failed');
                    passed_btn.setAttribute('aria-pressed', current_pc_status === 'passed' ? 'true' : 'false');
                    failed_btn.setAttribute('aria-pressed', current_pc_status === 'failed' ? 'true' : 'false');
                    passed_btn.parentElement.style.display = this.is_audit_locked ? 'none' : 'flex';
                }

                const observation_wrapper = pc_item_li.querySelector('.pc-observation-detail-wrapper');
                const observation_textarea = observation_wrapper.querySelector('textarea');

                const was_hidden = observation_wrapper.hidden;
                observation_wrapper.hidden = (current_pc_status !== 'failed');

                if (was_hidden && !observation_wrapper.hidden && !this.is_audit_locked) {
                    if (!window.focusProtectionActive && !window.customFocusApplied) {
                        observation_textarea.focus();
                    }
                }
                
                observation_textarea.readOnly = this.is_audit_locked;
                const target_observation_value = pc_data.observationDetail || '';
                if (document.activeElement !== observation_textarea &&
                    observation_textarea.value !== target_observation_value) {
                    observation_textarea.value = target_observation_value;
                }
                if (this.Helpers?.init_auto_resize_for_textarea) {
                    this.Helpers.init_auto_resize_for_textarea(observation_textarea);
                }

                const attach_media_btn = pc_item_li.querySelector('button[data-action="attach-media"]');
                if (attach_media_btn) {
                    const attached_filenames = Array.isArray(pc_data.attachedMediaFilenames)
                        ? pc_data.attachedMediaFilenames.filter(f => f && String(f).trim())
                        : [];
                    const attached_count = attached_filenames.length;
                    const attach_btn_label = attached_count > 0
                        ? t('edit_attached_media_button', { count: attached_count })
                        : t('attach_media_button');
                    const check_def = this.requirement_definition_ref?.checks?.find(c => (c?.id || c?.key) === check_id);
                    const pc_def = check_def?.passCriteria?.find(p => (p?.id || p?.key) === pc_id);
                    const check_idx = check_def ? (this.requirement_definition_ref.checks?.indexOf(check_def) ?? 0) : 0;
                    const pc_idx = pc_def ? (check_def?.passCriteria?.indexOf(pc_def) ?? 0) : 0;
                    const numbering = `${check_idx + 1}.${pc_idx + 1}`;
                    const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
                    const requirement_plain = this._get_plain_text_from_html(
                        this._safe_parse_markdown_inline(pc_def?.requirement || '')
                    );
                    const attach_aria_label = `${attach_btn_label} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
                    attach_media_btn.setAttribute('aria-label', attach_aria_label);
                    const text_span = attach_media_btn.querySelector('span:first-child');
                    if (text_span) {
                        text_span.textContent = attach_btn_label;
                    }
                }

                const copy_observation_row = pc_item_li.querySelector('.pc-copy-observation-row');
                if (copy_observation_row) {
                    const observations = this.get_observations_from_other_samples(check_id, pc_id);
                    const should_show = observations.length > 0 && current_pc_status === 'failed' && !this.is_audit_locked;
                    copy_observation_row.hidden = !should_show;
                }
            });
        });

        const stuck_btn = this.container_ref.querySelector('.stuck-button');
        if (stuck_btn) {
            const has_stuck_content = (this.requirement_result_ref?.stuckProblemDescription || '').trim() !== '';
            const check_id = stuck_btn.getAttribute('data-check-id');
            const pc_id = stuck_btn.getAttribute('data-pc-id');
            const check_def = this.requirement_definition_ref?.checks?.find(c => (c?.id || c?.key) === check_id);
            const pc_def = check_def?.passCriteria?.find(p => (p?.id || p?.key) === pc_id);
            const numbering = check_def && pc_def ? `${(this.requirement_definition_ref.checks?.indexOf(check_def) ?? 0) + 1}.${(check_def.passCriteria?.indexOf(pc_def) ?? 0) + 1}` : '';
            const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
            const requirement_plain = this._get_plain_text_from_html(
                this._safe_parse_markdown_inline(this.requirement_definition_ref?.title || '')
            );
            const stuck_aria_label = has_stuck_content
                ? `${t('stuck_button')} ${t('stuck_button_has_content')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`
                : `${t('stuck_button')} ${t('attach_media_aria_label_for')} ${criterion_title}: ${requirement_plain}`;
            stuck_btn.setAttribute('aria-label', stuck_aria_label);
            stuck_btn.classList.toggle('stuck-button--has-content', has_stuck_content);
            const text_span = stuck_btn.querySelector('span:first-child');
            if (text_span) {
                const indicator_html = has_stuck_content
                    ? ` <span class="stuck-button-indicator">${this.Helpers.escape_html(t('stuck_button_has_content'))}</span>`
                    : '';
                text_span.innerHTML = this.Helpers.escape_html(t('stuck_button')) + indicator_html;
            }
        }
    },

    render(requirement_definition, requirement_result, locked_status, update_details) {
        if (this.requirement_definition_ref !== requirement_definition) {
            this.is_dom_built = false;
        }
        this.requirement_definition_ref = requirement_definition;
        this.requirement_result_ref = requirement_result;
        this.is_audit_locked = locked_status;
        this.requirement_update_details = update_details || null;

        const current_lang = typeof this.Translation?.get_current_language_code === 'function'
            ? this.Translation.get_current_language_code()
            : null;
        if (this.last_language_code !== current_lang) {
            this.last_language_code = current_lang;
            this.is_dom_built = false;
        }

        if (!this.is_dom_built) {
            this.build_initial_dom();
        }

        this.update_dom();
    },

    flush_observations_before_destroy() {
        if (!this.container_ref || !this.requirement_result_ref?.checkResults) return;
        const textareas = this.container_ref.querySelectorAll('textarea.pc-observation-detail-textarea');
        textareas.forEach((textarea) => {
            const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
            const check_item = textarea.closest('.check-item[data-check-id]');
            if (pc_item && check_item) {
                const check_id = check_item.dataset.checkId;
                const pc_id = pc_item.dataset.pcId;
                const check_result = this.requirement_result_ref.checkResults[check_id];
                if (check_result?.passCriteria?.[pc_id]) {
                    const trimmed = this.Helpers?.trim_textarea_preserve_lines
                        ? this.Helpers.trim_textarea_preserve_lines(textarea.value || '')
                        : (textarea.value || '').trim();
                    check_result.passCriteria[pc_id].observationDetail = trimmed;
                }
            }
        });
    },

    destroy() {
        if (this.container_ref) {
            this.flush_observations_before_destroy();
            this.container_ref.removeEventListener('click', this.handle_checklist_click);
            this.container_ref.removeEventListener('input', this.handle_textarea_input);
            this.container_ref.removeEventListener('keydown', this.handle_checklist_keydown);
            this.container_ref.innerHTML = '';
        }
        this.is_dom_built = false;
        this.container_ref = null;
    }
};
