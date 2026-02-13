import { marked } from '../utils/markdown.js';

export const AuditProblemsViewComponent = {
    CSS_PATH: 'css/components/audit_problems_view_component.css',

    _safe_parse_markdown(markdown_string) {
        if (typeof marked === 'undefined' || !this.Helpers?.escape_html) {
            return this.Helpers?.escape_html?.(markdown_string) ?? String(markdown_string || '');
        }
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
        const parsed = marked.parse(String(markdown_string || ''), { renderer, breaks: true, gfm: true });
        return this.Helpers?.sanitize_html ? this.Helpers.sanitize_html(parsed) : parsed;
    },

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;
        this.NotificationComponent = deps.NotificationComponent;

        this.global_message_element_ref = this.NotificationComponent?.get_global_message_element_reference?.();

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }

        this.handle_requirement_link_click = this.handle_requirement_link_click.bind(this);
        this.handle_copy_click = this.handle_copy_click.bind(this);
        this.handle_copy_all_click = this.handle_copy_all_click.bind(this);
        this.handle_edit_click = this.handle_edit_click.bind(this);

        this.unsubscribe = null;
        if (typeof deps.subscribe === 'function') {
            this.unsubscribe = deps.subscribe(() => {
                if (this.root && window.__gv_current_view_name === 'audit_problems' && typeof this.render === 'function') {
                    this.render();
                }
            });
        }
    },

    build_hash(view_name, params = {}) {
        const has_params = params && Object.keys(params).length > 0;
        if (!has_params) return `#${view_name}`;
        return `#${view_name}?${new URLSearchParams(params).toString()}`;
    },

    _wrap_html_for_clipboard(html_content) {
        return `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"></head><body><!--StartFragment--><div>${html_content}</div><!--EndFragment--></body></html>`;
    },

    handle_requirement_link_click(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const sample_id = target?.getAttribute?.('data-sample-id');
        const requirement_id = target?.getAttribute?.('data-requirement-id');
        if (sample_id && requirement_id && typeof this.router === 'function') {
            this.router('requirement_audit', { sampleId: sample_id, requirementId: requirement_id });
        }
    },

    async handle_copy_click(event) {
        const btn = event.currentTarget;
        const card = btn.closest('.audit-problem-card');
        if (!card) return;

        const copyable = card.querySelector('.audit-problem-card__copyable-content');
        let html_content = copyable ? copyable.innerHTML : card.innerHTML;
        const plain_content = copyable ? (copyable.innerText || '').trim() : card.innerText;

        // Kravlänken ska kopieras som text, inte som länk. Övriga länkar behålls.
        if (copyable) {
            const clone = copyable.cloneNode(true);
            const req_link = clone.querySelector('.audit-problem-card__requirement-link');
            if (req_link) {
                const text_node = document.createTextNode(req_link.textContent || '');
                req_link.parentNode.replaceChild(text_node, req_link);
            }
            html_content = clone.innerHTML;
        }

        const wrapped_html = this._wrap_html_for_clipboard(html_content);

        try {
            if (navigator.clipboard?.write) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([wrapped_html], { type: 'text/html' }),
                        'text/plain': new Blob([plain_content], { type: 'text/plain' })
                    })
                ]);
            } else {
                await navigator.clipboard.writeText(plain_content);
            }

            const original_html = btn.innerHTML;
            btn.innerHTML = `<span>${this.Helpers.escape_html(this.Translation.t('audit_problems_copied_button'))}</span>`;
            btn.classList.add('audit-problem-copy-btn--copied');
            setTimeout(() => {
                btn.innerHTML = original_html;
                btn.classList.remove('audit-problem-copy-btn--copied');
            }, 15000);

            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(
                    this.Translation.t('audit_problems_copied_to_clipboard'),
                    'info'
                );
            }
        } catch (err) {
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(
                    this.Translation.t('audit_problems_copy_failed'),
                    'error'
                );
            }
        }
    },

    async handle_copy_all_click(event) {
        const btn = event.currentTarget;
        const plate = btn.closest('.audit-problems-plate');
        if (!plate) return;

        const cards = plate.querySelectorAll('.audit-problem-card');
        const html_parts = [];
        const plain_parts = [];

        cards.forEach((card) => {
            const copyable = card.querySelector('.audit-problem-card__copyable-content');
            if (!copyable) return;

            let html_content = copyable.innerHTML;
            const plain_content = (copyable.innerText || '').trim();
            if (!plain_content) return;

            const clone = copyable.cloneNode(true);
            const req_link = clone.querySelector('.audit-problem-card__requirement-link');
            if (req_link) {
                const text_node = document.createTextNode(req_link.textContent || '');
                req_link.parentNode.replaceChild(text_node, req_link);
            }
            html_content = clone.innerHTML;

            html_parts.push(html_content);
            plain_parts.push(plain_content);
        });

        if (html_parts.length === 0) return;

        const separator_html = '<hr style="margin:0.5rem 0;border:none;border-top:1px solid #ccc;">';
        const separator_plain = '\n——\n';

        const combined_html = html_parts.join(separator_html);
        const combined_plain = plain_parts.join(separator_plain);
        const wrapped_html = this._wrap_html_for_clipboard(combined_html);

        try {
            if (navigator.clipboard?.write) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([wrapped_html], { type: 'text/html' }),
                        'text/plain': new Blob([combined_plain], { type: 'text/plain' })
                    })
                ]);
            } else {
                await navigator.clipboard.writeText(combined_plain);
            }

            const original_html = btn.innerHTML;
            btn.innerHTML = `<span>${this.Helpers.escape_html(this.Translation.t('audit_problems_copied_button'))}</span>`;
            btn.classList.add('audit-problem-copy-btn--copied');
            setTimeout(() => {
                btn.innerHTML = original_html;
                btn.classList.remove('audit-problem-copy-btn--copied');
            }, 15000);

            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(
                    this.Translation.t('audit_problems_copied_to_clipboard'),
                    'info'
                );
            }
        } catch (err) {
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(
                    this.Translation.t('audit_problems_copy_failed'),
                    'error'
                );
            }
        }
    },

    handle_edit_click(event) {
        const btn = event.currentTarget;
        const sample_id = btn.dataset.sampleId;
        const req_id = btn.dataset.requirementId;
        const check_id = btn.dataset.checkId;
        const pc_id = btn.dataset.pcId;
        if (!sample_id || !req_id || !check_id || !pc_id || !this.dispatch || !this.StoreActionTypes) return;

        const ModalComponent = window.ModalComponent;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const state = this.getState();
        const sample = (state?.samples || []).find(s => String(s.id) === String(sample_id));
        const req_result = sample?.requirementResults?.[req_id];
        const check_result = req_result?.checkResults?.[check_id];
        const pc_result = check_result?.passCriteria?.[pc_id];
        if (!req_result || !check_result || !pc_result) return;

        const t = this.Translation.t;
        const existing_description = pc_result?.stuckProblemDescription || '';

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
                    const req_def = (state?.ruleFileContent?.requirements || {})[req_id] || (Array.isArray(state?.ruleFileContent?.requirements) ? state.ruleFileContent.requirements.find(r => (r?.key || r?.id) === req_id) : null);
                    const modified_result = JSON.parse(JSON.stringify(req_result));
                    if (modified_result.checkResults?.[check_id]?.passCriteria?.[pc_id]) {
                        modified_result.checkResults[check_id].passCriteria[pc_id].stuckProblemDescription = description;
                    }
                    if (req_def && this.AuditLogic?.calculate_requirement_status) {
                        modified_result.status = this.AuditLogic.calculate_requirement_status(req_def, modified_result);
                    }
                    this.dispatch({
                        type: this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
                        payload: {
                            sampleId: sample_id,
                            requirementId: req_id,
                            newRequirementResult: modified_result
                        }
                    });
                    this.render();
                    modal.close(btn);
                });
                const discard_btn = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('stuck_modal_discard')
                });
                discard_btn.addEventListener('click', () => {
                    modal.close(btn);
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
                        const modified_result = JSON.parse(JSON.stringify(req_result));
                        if (modified_result.checkResults?.[check_id]?.passCriteria?.[pc_id]) {
                            modified_result.checkResults[check_id].passCriteria[pc_id].stuckProblemDescription = '';
                        }
                        const req_def = (state?.ruleFileContent?.requirements || {})[req_id] || (Array.isArray(state?.ruleFileContent?.requirements) ? state.ruleFileContent.requirements.find(r => (r?.key || r?.id) === req_id) : null);
                        if (req_def && this.AuditLogic?.calculate_requirement_status) {
                            modified_result.status = this.AuditLogic.calculate_requirement_status(req_def, modified_result);
                        }
                        this.dispatch({
                            type: this.StoreActionTypes.UPDATE_REQUIREMENT_RESULT,
                            payload: {
                                sampleId: sample_id,
                                requirementId: req_id,
                                newRequirementResult: modified_result
                            }
                        });
                        this.render();
                        modal.close(btn);
                    });
                    actions_wrapper.appendChild(problem_solved_btn);
                }
                container.appendChild(actions_wrapper);
            }
        );
    },

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const state = this.getState();
        if (!state?.ruleFileContent) {
            const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_problems_title') }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            return;
        }

        const problems = this.AuditLogic?.collect_audit_problems ? this.AuditLogic.collect_audit_problems(state) : [];

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate audit-problems-plate' });
        this.root.appendChild(plate);

        if (this.global_message_element_ref) {
            plate.appendChild(this.global_message_element_ref);
        }

        const header_row = this.Helpers.create_element('div', { class_name: 'audit-problems-header-row' });
        const h1 = this.Helpers.create_element('h1', { text_content: t('audit_problems_title') });
        header_row.appendChild(h1);

        if (problems.length > 0) {
            const copy_all_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('content_copy', ['currentColor'], 16) : '';
            const copy_all_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'audit-problem-copy-btn', 'audit-problem-copy-all-btn'],
                attributes: { type: 'button' },
                html_content: `<span>${this.Helpers.escape_html(t('audit_problems_copy_all_button'))}</span>${copy_all_icon ? `<span aria-hidden="true">${copy_all_icon}</span>` : ''}`
            });
            copy_all_btn.addEventListener('click', this.handle_copy_all_click);
            header_row.appendChild(copy_all_btn);
        }

        plate.appendChild(header_row);

        const intro = this.Helpers.create_element('p', {
            class_name: 'audit-problems-intro',
            text_content: t('audit_problems_intro')
        });
        plate.appendChild(intro);

        const list_wrapper = this.Helpers.create_element('div', { class_name: 'audit-problems-list' });
        plate.appendChild(list_wrapper);

        if (problems.length === 0) {
            const empty_msg = this.Helpers.create_element('p', {
                class_name: 'audit-problems-empty',
                text_content: t('audit_problems_empty')
            });
            list_wrapper.appendChild(empty_msg);
        } else {
            const grouped = this.group_problems_by_requirement_sample(problems);
            grouped.forEach((group) => {
                const card = this.create_problem_card(group, t);
                list_wrapper.appendChild(card);
            });
        }
    },

    group_problems_by_requirement_sample(problems) {
        const map = new Map();
        problems.forEach((item) => {
            const key = `${item.reqId}::${item.sample?.id || ''}`;
            if (!map.has(key)) {
                map.set(key, {
                    requirement: item.requirement,
                    sample: item.sample,
                    reqId: item.reqId,
                    items: []
                });
            }
            map.get(key).items.push(item);
        });
        return Array.from(map.values());
    },

    create_problem_card(group, t) {
        const card = this.Helpers.create_element('article', { class_name: 'audit-problem-card' });

        const copyable_content = this.Helpers.create_element('div', { class_name: 'audit-problem-card__copyable-content' });

        const req_title = group.requirement?.title || group.reqId || '';
        const std_ref = group.requirement?.standardReference;
        const ref_text = std_ref?.text?.trim() || '';
        const ref_url = std_ref?.url?.trim() || '';
        const sample_name = group.sample?.description || group.sample?.id || '';
        const sample_url = group.sample?.url?.trim() || '';
        const sample_id = group.sample?.id || '';
        const req_id = group.reqId || '';

        const req_row = this.Helpers.create_element('h2', { class_name: 'audit-problem-card__row audit-problem-card__requirement-row' });
        const req_label = this.Helpers.create_element('span', {
            class_name: 'audit-problem-card__label',
            text_content: `${t('audit_images_card_requirement_label')} `
        });
        req_row.appendChild(req_label);
        const req_link = this.Helpers.create_element('a', {
            class_name: 'audit-problem-card__requirement-link',
            attributes: {
                href: this.build_hash('requirement_audit', { sampleId: sample_id, requirementId: req_id }),
                'data-sample-id': sample_id,
                'data-requirement-id': req_id
            },
            text_content: req_title
        });
        req_link.addEventListener('click', this.handle_requirement_link_click);
        req_row.appendChild(req_link);
        copyable_content.appendChild(req_row);

        if (ref_text) {
            const ref_row = this.Helpers.create_element('p', { class_name: 'audit-problem-card__row' });
            const ref_label = this.Helpers.create_element('span', {
                class_name: 'audit-problem-card__label',
                text_content: `${t('audit_images_card_reference_label')} `
            });
            ref_row.appendChild(ref_label);
            if (ref_url && this.Helpers.add_protocol_if_missing) {
                const ref_link = this.Helpers.create_element('a', {
                    attributes: {
                        href: this.Helpers.add_protocol_if_missing(ref_url),
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    },
                    text_content: ref_text
                });
                ref_row.appendChild(ref_link);
            } else {
                ref_row.appendChild(document.createTextNode(ref_text));
            }
            copyable_content.appendChild(ref_row);
        }

        const sample_row = this.Helpers.create_element('p', { class_name: 'audit-problem-card__row' });
        const sample_label = this.Helpers.create_element('span', {
            class_name: 'audit-problem-card__label',
            text_content: `${t('audit_images_card_sample_label')} `
        });
        sample_row.appendChild(sample_label);
        if (sample_url && this.Helpers.add_protocol_if_missing) {
            const sample_link = this.Helpers.create_element('a', {
                attributes: {
                    href: this.Helpers.add_protocol_if_missing(sample_url),
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                text_content: sample_name || sample_url
            });
            sample_row.appendChild(sample_link);
        } else {
            sample_row.appendChild(document.createTextNode(sample_name || ''));
        }
        copyable_content.appendChild(sample_row);

        const edit_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('edit', ['currentColor'], 16) : '';
        const copy_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('content_copy', ['currentColor'], 16) : '';

        group.items.forEach((item) => {
            const section = this.Helpers.create_element('div', { class_name: 'audit-problem-card__pc-section' });
            const { check_def, pc_def, check_index, pc_index, observation_text, stuck_text, checkId, pcId } = item;
            const check_num = check_index >= 0 ? check_index + 1 : '';
            const pc_num = check_index >= 0 && pc_index >= 0 ? `${check_index + 1}.${pc_index + 1}` : '';

            if (check_def?.condition) {
                const check_label_p = this.Helpers.create_element('p', {
                    class_name: 'audit-problem-card__checkpoint',
                    html_content: `<strong>${this.Helpers.escape_html(t('check_item_title'))} ${check_num}:</strong>`
                });
                section.appendChild(check_label_p);
                const check_text_p = this.Helpers.create_element('p', {
                    class_name: 'audit-problem-card__checkpoint-text',
                    text_content: check_def.condition
                });
                section.appendChild(check_text_p);
            }
            if (pc_def?.requirement) {
                const pc_label_p = this.Helpers.create_element('p', {
                    class_name: 'audit-problem-card__pass-criterion',
                    html_content: `<strong>${this.Helpers.escape_html(t('pass_criterion_label'))} ${pc_num}:</strong>`
                });
                section.appendChild(pc_label_p);
                const pc_text_p = this.Helpers.create_element('p', {
                    class_name: 'audit-problem-card__pass-criterion-text',
                    text_content: pc_def.requirement
                });
                section.appendChild(pc_text_p);
            }
            if (observation_text) {
                const obs_label_p = this.Helpers.create_element('p', {
                    class_name: 'audit-problem-card__observation-label',
                    html_content: `<strong>${this.Helpers.escape_html(t('audit_problems_card_observation_label'))}:</strong>`
                });
                section.appendChild(obs_label_p);
                const obs_div = this.Helpers.create_element('div', {
                    class_name: 'audit-problem-card__observation-text markdown-content',
                    html_content: this._safe_parse_markdown(observation_text)
                });
                section.appendChild(obs_div);
            }
            const desc_label_p = this.Helpers.create_element('p', {
                class_name: 'audit-problem-card__description-label',
                html_content: `<strong>${this.Helpers.escape_html(t('audit_problems_card_description_label'))}:</strong>`
            });
            section.appendChild(desc_label_p);
            const stuck_div = this.Helpers.create_element('div', {
                class_name: 'audit-problem-card__stuck-text markdown-content',
                html_content: this._safe_parse_markdown(stuck_text)
            });
            section.appendChild(stuck_div);
            copyable_content.appendChild(section);
        });

        card.appendChild(copyable_content);

        const buttons_row = this.Helpers.create_element('div', { class_name: 'audit-problem-card__buttons-row' });
        group.items.forEach((item) => {
            const edit_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'audit-problem-edit-btn'],
                attributes: {
                    type: 'button',
                    'data-sample-id': sample_id,
                    'data-requirement-id': req_id,
                    'data-check-id': item.checkId || '',
                    'data-pc-id': item.pcId || ''
                },
                html_content: `<span>${this.Helpers.escape_html(t('audit_problems_edit_button'))}</span>${edit_icon ? `<span aria-hidden="true">${edit_icon}</span>` : ''}`
            });
            edit_btn.addEventListener('click', this.handle_edit_click);
            buttons_row.appendChild(edit_btn);
        });
        const copy_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'audit-problem-copy-btn'],
            attributes: { type: 'button' },
            html_content: `<span>${this.Helpers.escape_html(t('audit_problems_copy_button'))}</span>${copy_icon ? `<span aria-hidden="true">${copy_icon}</span>` : ''}`
        });
        copy_btn.addEventListener('click', this.handle_copy_click);
        buttons_row.appendChild(copy_btn);

        card.appendChild(buttons_row);

        return card;
    },

    destroy() {
        if (typeof this.unsubscribe === 'function') {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.AuditLogic = null;
        this.NotificationComponent = null;
        this.global_message_element_ref = null;
    }
};
