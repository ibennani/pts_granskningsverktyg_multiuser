import { get_current_user_name } from '../utils/helpers.js';
import { show_confirm_delete_modal } from '../logic/confirm_delete_modal_logic.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { marked } from '../utils/markdown.js';
import './audit_problems_view_component.css';
import { build_compact_hash_fragment } from '../logic/router_url_codec.js';
import { consoleManager } from '../utils/console_manager.js';

export class AuditProblemsViewComponent {
    constructor() {
        this.CSS_PATH = './audit_problems_view_component.css';
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
        this.unsubscribe = null;
        this._problems_signature = null;
        this._previous_problems_keys = null;
        this._focus_after_problem_solved = null;
    }

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
    }

    async init({ root, deps }) {
        if (window.__GV_DEBUG_PROBLEMS_UPDATE__) consoleManager.log('[GV-Debug problems] init: start');
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

        // Hämta senaste granskningen från servern så att antal och lista stämmer med DB (t.ex. vid återbesök eller flik med gammal session).
        const state = this.getState();
        if (window.__GV_DEBUG_PROBLEMS_UPDATE__) {
            const before_count = this.AuditLogic?.count_audit_problems ? this.AuditLogic.count_audit_problems(state) : -1;
            consoleManager.log('[GV-Debug problems] init: state innan fetch, kört-fast i state:', before_count, 'auditId:', state?.auditId || 'saknas');
        }
        if (state?.auditId && typeof this.dispatch === 'function') {
            try {
                const { load_audit_with_rule_file } = await import('../api/client.js');
                const full_state = await load_audit_with_rule_file(state.auditId);
                if (window.__GV_DEBUG_PROBLEMS_UPDATE__ && full_state?.samples) {
                    const stuck_from_server = (full_state.samples || []).reduce((n, s) => {
                        return n + Object.values(s?.requirementResults || {}).filter((r) => (r?.stuckProblemDescription || '').trim() !== '').length;
                    }, 0);
                    consoleManager.log('[GV-Debug problems] init: från servern, kört-fast i samples:', stuck_from_server, 'samples.length:', full_state.samples?.length);
                }
                if (full_state && full_state.samples) {
                    await this.dispatch({
                        type: this.StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
                        payload: { ...full_state, saveFileVersion: full_state.saveFileVersion || '2.1.0' }
                    });
                    if (window.__GV_DEBUG_PROBLEMS_UPDATE__) {
                        const after_state = this.getState();
                        const after_count = this.AuditLogic?.count_audit_problems ? this.AuditLogic.count_audit_problems(after_state) : -1;
                        consoleManager.log('[GV-Debug problems] init: efter dispatch, kört-fast i state:', after_count);
                    }
                } else if (window.__GV_DEBUG_PROBLEMS_UPDATE__) {
                    consoleManager.log('[GV-Debug problems] init: full_state saknas eller samples saknas', { has_full_state: !!full_state, has_samples: !!full_state?.samples });
                }
            } catch (e) {
                if (window.__GV_DEBUG_PROBLEMS_UPDATE__) console.warn('[GV-Debug problems] init: fetch/dispatch fel', e);
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[AuditProblemsViewComponent] Kunde inte hämta granskning från servern:', e);
            }
        } else if (window.__GV_DEBUG_PROBLEMS_UPDATE__) {
            consoleManager.log('[GV-Debug problems] init: hoppar över fetch', { has_auditId: !!state?.auditId, has_dispatch: typeof this.dispatch === 'function' });
        }

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }

        this.handle_requirement_link_click = this.handle_requirement_link_click.bind(this);
        this.handle_copy_click = this.handle_copy_click.bind(this);
        this.handle_copy_all_click = this.handle_copy_all_click.bind(this);
        this.handle_edit_click = this.handle_edit_click.bind(this);
        this.handle_problem_solved_click = this.handle_problem_solved_click.bind(this);

        this._problems_signature = null;
        this._previous_problems_keys = null;
        this.unsubscribe = null;
        if (typeof deps.subscribe === 'function') {
            this.unsubscribe = deps.subscribe(() => {
                if (!this.root || window.__gv_current_view_name !== 'audit_problems' || typeof this.render !== 'function') return;
                const state = this.getState();
                const problems = this.AuditLogic?.collect_audit_problems ? this.AuditLogic.collect_audit_problems(state) : [];
                const signature = JSON.stringify(problems.map((p) => ({ s: p.sample?.id, r: p.reqId, l: (p.stuck_text || '').length })));
                if (this._problems_signature === signature) return;
                const new_keys = new Set(problems.map((p) => `${p.sample?.id ?? ''}|${p.reqId ?? ''}`));
                const prev_keys = this._previous_problems_keys || new Set();
                const added_keys = new Set([...new_keys].filter((k) => !prev_keys.has(k)));
                const removed_keys = new Set([...prev_keys].filter((k) => !new_keys.has(k)));
                const content_only_change = added_keys.size === 0 && removed_keys.size === 0;
                if (content_only_change) {
                    this._problems_signature = signature;
                    this._previous_problems_keys = new Set(new_keys);
                    this.render();
                    return;
                }
                const list_wrapper = this.root.querySelector('.audit-problems-list');
                if (!list_wrapper) {
                    this._problems_signature = signature;
                    this._previous_problems_keys = new Set(new_keys);
                    this.render();
                    return;
                }
                const t = this.Translation.t;
                if (added_keys.size > 0) {
                    const empty_el = list_wrapper.querySelector('.audit-problems-empty');
                    if (empty_el) empty_el.remove();
                    problems.forEach((item) => {
                        const key = `${item.sample?.id ?? ''}|${item.reqId ?? ''}`;
                        if (added_keys.has(key)) {
                            list_wrapper.appendChild(this.create_problem_card(item, t));
                        }
                    });
                }
                if (removed_keys.size > 0) {
                    removed_keys.forEach((key) => {
                        const [sample_id, req_id] = key.split('|');
                        const card = list_wrapper.querySelector(
                            `.audit-problem-card[data-sample-id="${CSS.escape(sample_id)}"][data-requirement-id="${CSS.escape(req_id)}"]`
                        );
                        if (card) card.remove();
                    });
                    const remaining = list_wrapper.querySelectorAll('.audit-problem-card');
                    if (remaining.length === 0) {
                        const empty_msg = this.Helpers.create_element('p', {
                            class_name: 'audit-problems-empty',
                            text_content: t('audit_problems_empty')
                        });
                        list_wrapper.appendChild(empty_msg);
                    }
                }
                this._problems_signature = signature;
                this._previous_problems_keys = new Set(new_keys);
            });
        }
    }

    build_hash(view_name, params = {}) {
        return `#${build_compact_hash_fragment(view_name, params && typeof params === 'object' ? params : {})}`;
    }

    _wrap_html_for_clipboard(html_content) {
        return `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"></head><body><!--StartFragment--><div>${html_content}</div><!--EndFragment--></body></html>`;
    }

    handle_requirement_link_click(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const sample_id = target?.getAttribute?.('data-sample-id');
        const requirement_id = target?.getAttribute?.('data-requirement-id');
        if (sample_id && requirement_id && typeof this.router === 'function') {
            this.router('requirement_audit', { sampleId: sample_id, requirementId: requirement_id });
        }
    }

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
    }

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
    }

    _apply_focus_after_problem_solved() {
        const focus_spec = this._focus_after_problem_solved;
        this._focus_after_problem_solved = null;
        if (!focus_spec || !this.root) return;
        const plate = this.root.querySelector('.audit-problems-plate');
        if (!plate) return;
        let target = null;
        if (focus_spec.next?.sample_id && focus_spec.next?.requirement_id) {
            target = plate.querySelector(
                `.audit-problem-card__requirement-link[data-sample-id="${CSS.escape(focus_spec.next.sample_id)}"][data-requirement-id="${CSS.escape(focus_spec.next.requirement_id)}"]`
            );
        }
        if (!target && focus_spec.prev?.sample_id && focus_spec.prev?.requirement_id) {
            target = plate.querySelector(
                `.audit-problem-card__requirement-link[data-sample-id="${CSS.escape(focus_spec.prev.sample_id)}"][data-requirement-id="${CSS.escape(focus_spec.prev.requirement_id)}"]`
            );
        }
        if (!target) {
            // Om inga kort kvar eller ingen matchande rubrik – fokusera huvudrubriken för vyn
            target = plate.querySelector('.audit-problems-header-row h1');
        }
        if (target && typeof target.focus === 'function') {
            try {
                target.focus({ preventScroll: true });
            } catch (e) {
                target.focus();
            }
        }
    }

    handle_problem_solved_click(event) {
        const btn = event.currentTarget;
        const sample_id = btn.dataset.sampleId;
        const req_id = btn.dataset.requirementId;
        if (!sample_id || !req_id || !this.dispatch || !this.StoreActionTypes) return;

        const plate = btn.closest('.audit-problems-plate');
        const cards = plate ? Array.from(plate.querySelectorAll('.audit-problem-card')) : [];
        const current_card = btn.closest('.audit-problem-card');
        const current_index = current_card ? cards.indexOf(current_card) : -1;

        const get_link_ids = (card_el) => {
            if (!card_el) return null;
            const link = card_el.querySelector('.audit-problem-card__requirement-link');
            if (!link) return null;
            const sid = link.getAttribute('data-sample-id');
            const rid = link.getAttribute('data-requirement-id');
            return (sid && rid) ? { sample_id: sid, requirement_id: rid } : null;
        };
        const next_ids = current_index >= 0 && current_index < cards.length - 1 ? get_link_ids(cards[current_index + 1]) : null;
        const prev_ids = current_index > 0 ? get_link_ids(cards[current_index - 1]) : null;
        this._focus_after_problem_solved = { next: next_ids, prev: prev_ids };

        const t = this.Translation.t;

        const perform_delete = () => {
            const state = this.getState();
            const sample = (state?.samples || []).find(s => String(s.id) === String(sample_id));
            const req_result = sample?.requirementResults?.[req_id];
            if (!req_result) return;

            const modified_result = JSON.parse(JSON.stringify(req_result));
            modified_result.stuckProblemDescription = '';
            modified_result.lastStatusUpdate = this.Helpers?.get_current_iso_datetime_utc?.() || new Date().toISOString();
            modified_result.lastStatusUpdateBy = get_current_user_name();
            const req_def = (state?.ruleFileContent?.requirements || {})[req_id]
                || (Array.isArray(state?.ruleFileContent?.requirements)
                    ? state.ruleFileContent.requirements.find(r => (r?.key || r?.id) === req_id)
                    : null);
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
            setTimeout(() => {
                requestAnimationFrame(() => this._apply_focus_after_problem_solved());
            }, 50);
        };

        if (typeof show_confirm_delete_modal === 'function') {
            show_confirm_delete_modal({
                h1_text: t('problem_solved_confirm_modal_title'),
                warning_text: t('problem_solved_confirm_modal_message'),
                delete_button: btn,
                on_confirm: perform_delete,
                yes_label: t('problem_solved_confirm_modal_confirm_btn'),
                no_label: t('problem_solved_confirm_modal_cancel_btn')
            });
        } else {
            // Fallback om modalkomponenten inte finns – utför borttagning direkt
            perform_delete();
        }
    }

    handle_edit_click(event) {
        const btn = event.currentTarget;
        const sample_id = btn.dataset.sampleId;
        const req_id = btn.dataset.requirementId;
        if (!sample_id || !req_id || !this.dispatch || !this.StoreActionTypes) return;

        const ModalComponent = app_runtime_refs.modal_component;
        if (!ModalComponent?.show || !this.Helpers?.create_element) return;

        const state = this.getState();
        const sample = (state?.samples || []).find(s => String(s.id) === String(sample_id));
        const req_result = sample?.requirementResults?.[req_id];
        if (!req_result) return;

        const t = this.Translation.t;
        const existing_description = (typeof req_result.stuckProblemDescription === 'string')
            ? req_result.stuckProblemDescription
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
                    const req_def = (state?.ruleFileContent?.requirements || {})[req_id] || (Array.isArray(state?.ruleFileContent?.requirements) ? state.ruleFileContent.requirements.find(r => (r?.key || r?.id) === req_id) : null);
                    const modified_result = JSON.parse(JSON.stringify(req_result));
                    modified_result.stuckProblemDescription = description;
                    modified_result.lastStatusUpdate = this.Helpers?.get_current_iso_datetime_utc?.() || new Date().toISOString();
                    modified_result.lastStatusUpdateBy = get_current_user_name();
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
                        modified_result.stuckProblemDescription = '';
                        modified_result.lastStatusUpdate = this.Helpers?.get_current_iso_datetime_utc?.() || new Date().toISOString();
                        modified_result.lastStatusUpdateBy = get_current_user_name();
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
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const state = this.getState();
        if (!state?.ruleFileContent) {
            this._problems_signature = 'no-rulefile';
            this._previous_problems_keys = new Set();
            const plate = this.Helpers.create_element('div', { class_name: 'content-plate' });
            plate.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_problems_title') }));
            plate.appendChild(this.Helpers.create_element('p', { text_content: t('error_no_active_audit') }));
            this.root.appendChild(plate);
            return;
        }

        const problems = this.AuditLogic?.collect_audit_problems ? this.AuditLogic.collect_audit_problems(state) : [];
        if (window.__GV_DEBUG_PROBLEMS_UPDATE__) {
            consoleManager.log('[GV-Debug problems] render: antal problem att rita:', problems.length, 'ruleFileContent.requirements:', state?.ruleFileContent?.requirements ? 'finns' : 'saknas');
        }
        this._problems_signature = JSON.stringify(problems.map((p) => ({ s: p.sample?.id, r: p.reqId, l: (p.stuck_text || '').length })));
        this._previous_problems_keys = new Set(problems.map((p) => `${p.sample?.id ?? ''}|${p.reqId ?? ''}`));

        const plate = this.Helpers.create_element('div', { class_name: 'content-plate audit-problems-plate' });
        this.root.appendChild(plate);

        this.NotificationComponent?.append_global_message_areas_to?.(plate);

        const header_row = this.Helpers.create_element('div', { class_name: 'audit-problems-header-row' });
        const problems_count = problems.length;
        const heading_text = problems_count > 1
            ? t('audit_problems_title_with_count', { count: problems_count })
            : t('audit_problems_title');
        const h1 = this.Helpers.create_element('h1', {
            text_content: heading_text,
            attributes: { tabindex: '-1' }
        });
        header_row.appendChild(h1);

        const has_any_copyable = problems.some((p) => {
            const stuck = (p.stuck_text || '').trim();
            const title = (p.requirement?.title || p.reqId || '').trim();
            const sample_desc = (p.sample?.description || p.sample?.id || '').trim();
            return !!(stuck || title || sample_desc);
        });
        if (problems.length > 0 && has_any_copyable) {
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
            problems.forEach((item) => {
                const card = this.create_problem_card(item, t);
                list_wrapper.appendChild(card);
            });
        }
    }

    create_problem_card(item, t) {
        const sample_id = item.sample?.id ?? '';
        const req_id = item.reqId ?? '';
        const card = this.Helpers.create_element('article', {
            class_name: 'audit-problem-card',
            attributes: { 'data-sample-id': String(sample_id), 'data-requirement-id': String(req_id) }
        });

        const copyable_content = this.Helpers.create_element('div', { class_name: 'audit-problem-card__copyable-content' });

        const req_title = item.requirement?.title || item.reqId || '';
        const std_ref = item.requirement?.standardReference;
        const ref_text = std_ref?.text?.trim() || '';
        const ref_url = std_ref?.url?.trim() || '';
        const sample_name = item.sample?.description || item.sample?.id || '';
        const sample_url = item.sample?.url?.trim() || '';

        const req_row = this.Helpers.create_element('h2', { class_name: 'audit-problem-card__row audit-problem-card__requirement-row' });
        const req_label = this.Helpers.create_element('span', {
            class_name: 'audit-problem-card__label',
            text_content: `${t('audit_images_card_requirement_label')} `
        });
        req_row.appendChild(req_label);
        const base_path = (window.location && window.location.pathname)
            ? window.location.pathname.split('?')[0].split('#')[0]
            : '/';
        const href_params = new URLSearchParams({ view: 'requirement_audit', sampleId: sample_id, requirementId: req_id });
        const req_link = this.Helpers.create_element('a', {
            class_name: 'audit-problem-card__requirement-link',
            attributes: {
                href: `${base_path}?${href_params.toString()}`,
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
                const icon_html = this.Helpers.get_external_link_icon_html ? this.Helpers.get_external_link_icon_html(t) : ' ↗';
                const ref_link = this.Helpers.create_element('a', {
                    attributes: {
                        href: this.Helpers.add_protocol_if_missing(ref_url),
                        target: '_blank',
                        rel: 'noopener noreferrer'
                    },
                    html_content: (this.Helpers.escape_html ? this.Helpers.escape_html(ref_text) : ref_text) + icon_html
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
            const icon_html = this.Helpers.get_external_link_icon_html ? this.Helpers.get_external_link_icon_html(t) : ' ↗';
            const sample_link = this.Helpers.create_element('a', {
                attributes: {
                    href: this.Helpers.add_protocol_if_missing(sample_url),
                    target: '_blank',
                    rel: 'noopener noreferrer'
                },
                html_content: (this.Helpers.escape_html ? this.Helpers.escape_html(sample_name || sample_url) : (sample_name || sample_url)) + icon_html
            });
            sample_row.appendChild(sample_link);
        } else {
            sample_row.appendChild(document.createTextNode(sample_name || ''));
        }
        copyable_content.appendChild(sample_row);

        const section = this.Helpers.create_element('div', { class_name: 'audit-problem-card__pc-section' });
        const desc_label_p = this.Helpers.create_element('p', {
            class_name: 'audit-problem-card__description-label',
            html_content: `<strong>${this.Helpers.escape_html(t('audit_problems_card_description_label'))}:</strong>`
        });
        section.appendChild(desc_label_p);
        const stuck_div = this.Helpers.create_element('div', {
            class_name: 'audit-problem-card__stuck-text markdown-content',
            html_content: this._safe_parse_markdown(item.stuck_text || '')
        });
        section.appendChild(stuck_div);
        copyable_content.appendChild(section);

        card.appendChild(copyable_content);

        const edit_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('edit', ['currentColor'], 16) : '';
        const copy_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('content_copy', ['currentColor'], 16) : '';
        const buttons_row = this.Helpers.create_element('div', { class_name: 'audit-problem-card__buttons-row' });
        const edit_btn_aria_label = `${t('audit_problems_edit_button')}: ${req_title}`;
        const edit_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'audit-problem-edit-btn'],
            attributes: {
                type: 'button',
                'data-sample-id': sample_id,
                'data-requirement-id': req_id,
                'aria-label': edit_btn_aria_label
            },
            html_content: `<span>${this.Helpers.escape_html(t('audit_problems_edit_button'))}</span>${edit_icon ? `<span aria-hidden="true">${edit_icon}</span>` : ''}`
        });
        edit_btn.addEventListener('click', this.handle_edit_click);
        buttons_row.appendChild(edit_btn);
        const copy_btn_aria_label = `${t('audit_problems_copy_button')}: ${req_title}`;
        const copy_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'audit-problem-copy-btn'],
            attributes: { type: 'button', 'aria-label': copy_btn_aria_label },
            html_content: `<span>${this.Helpers.escape_html(t('audit_problems_copy_button'))}</span>${copy_icon ? `<span aria-hidden="true">${copy_icon}</span>` : ''}`
        });
        copy_btn.addEventListener('click', this.handle_copy_click);
        buttons_row.appendChild(copy_btn);

        const has_stuck_text = (item.stuck_text || '').trim() !== '';
        if (has_stuck_text) {
            const delete_icon = this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('delete', ['currentColor'], 16) : '';
            const solved_btn_aria_label = `${t('stuck_modal_problem_solved')}: ${req_title}`;
            const solved_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-danger', 'audit-problem-solved-btn'],
                attributes: {
                    type: 'button',
                    'data-sample-id': sample_id,
                    'data-requirement-id': req_id,
                    'aria-label': solved_btn_aria_label
                },
                html_content: `<span>${this.Helpers.escape_html(t('stuck_modal_problem_solved'))}</span>${delete_icon ? `<span aria-hidden="true">${delete_icon}</span>` : ''}`
            });
            solved_btn.addEventListener('click', this.handle_problem_solved_click);
            buttons_row.appendChild(solved_btn);
        }

        card.appendChild(buttons_row);

        return card;
    }

    destroy() {
        if (typeof this.unsubscribe === 'function') {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this._problems_signature = null;
        this._previous_problems_keys = null;
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
    }
}
