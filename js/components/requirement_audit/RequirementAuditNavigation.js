// js/components/requirement_audit/RequirementAuditNavigation.js

import { wrap_with_static_tooltip } from '../../utils/generic_tooltip.js';

export class RequirementAuditNavigationComponent {
    constructor() {
        this.container_ref = null;
        this.on_navigate_callback = null;
        this.Translation = null;
        this.Helpers = null;
        this.AuditLogic = null;
        
        // Bind methods
        this.handle_back_click = this.handle_back_click.bind(this);
        this.handle_confirm_click = this.handle_confirm_click.bind(this);
        this.handle_prev_click = this.handle_prev_click.bind(this);
        this.handle_next_click = this.handle_next_click.bind(this);
        this.handle_next_unhandled_click = this.handle_next_unhandled_click.bind(this);
    }

    init(container, on_navigate_cb, options = {}) {
        this.container_ref = container;
        this.on_navigate_callback = on_navigate_cb;
        
        const deps = options.deps || {};
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.AuditLogic = deps.AuditLogic;
    }
    
    // Event handlers to facilitate clean removal if needed, though replaceWith(clone) does it too.
    handle_back_click() { this.on_navigate_callback('back_to_list'); }
    handle_confirm_click() { this.on_navigate_callback('confirm_reviewed_status'); }
    handle_prev_click() { this.on_navigate_callback('previous'); }
    handle_next_click() { this.on_navigate_callback('next'); }
    handle_next_unhandled_click() { this.on_navigate_callback('next_unhandled'); }

    render(options) {
        if (!this.container_ref || !this.Translation || !this.Helpers) return;

        const {
            is_first_requirement,
            is_last_requirement,
            sample_object,
            rule_file_content,
            requirement_result,
            current_requirement_id,
            previous_aria_label,
            next_aria_label,
            next_unhandled_aria_label,
            next_unhandled_available,
            previous_text_key = 'previous_requirement',
            next_text_key = 'next_requirement',
            next_unhandled_text_key = 'next_unhandled_requirement'
        } = options;

        const t = this.Translation.t;

        /** Behåll tangentbordsfokus om navigeringen byggs om medan en knapp redan är fokuserad. */
        let restore_focus_action = null;
        const ae_before_clear = document.activeElement;
        if (
            ae_before_clear &&
            this.container_ref.contains(ae_before_clear) &&
            ae_before_clear.tagName === 'BUTTON'
        ) {
            const da = ae_before_clear.getAttribute('data-action');
            if (da) restore_focus_action = da;
        }

        this.container_ref.innerHTML = '';

        const shortcut_display = (key) => (t(key) || key).toString().charAt(0).toUpperCase();
        const aria_keyshortcuts = (key) => `Shift+Alt+${shortcut_display(key)}`;

        const nav_group_left = this.Helpers.create_element('div', { class_name: 'nav-group-left' });
        const nav_group_right = this.Helpers.create_element('div', { class_name: 'nav-group-right' });

        // "Back to list" button
        const back_key = 'shortcut_key_back_to_list';
        const back_btn = this.Helpers.create_element('button', {
            class_name: 'button button-default',
            html_content: `<span>${t('back_to_requirement_list')}</span>` + this.Helpers.get_icon_svg('arrow_back', [], 18),
            attributes: { 'aria-keyshortcuts': aria_keyshortcuts(back_key), 'data-action': 'back-to-list' }
        });
        back_btn.addEventListener('click', this.handle_back_click);
        nav_group_left.appendChild(
            wrap_with_static_tooltip(
                this.Helpers,
                back_btn,
                `${t('back_to_requirement_list')} (Shift+Alt+${shortcut_display(back_key)})`,
                { use_overlay: false }
            )
        );

        // "Confirm status" button for updated requirements
        if (requirement_result?.needsReview === true) {
            const status = requirement_result.status;
            let btn_text_key = 'confirm_status_and_return';
            let btn_class = 'button-secondary';
            if (status === 'passed') { btn_text_key = 'confirm_status_passed'; btn_class = 'button-success'; }
            else if (status === 'failed') { btn_text_key = 'confirm_status_failed'; btn_class = 'button-danger'; }
            
            const confirm_btn = this.Helpers.create_element('button', {
                class_name: ['button', btn_class],
                html_content: `<span>${t(btn_text_key)}</span>` + this.Helpers.get_icon_svg('check', [], 18),
                attributes: { 'data-action': 'confirm-reviewed-status' }
            });
            confirm_btn.addEventListener('click', this.handle_confirm_click);
            nav_group_left.appendChild(confirm_btn);
        }

        // Föregående/nästa/nästa ohanterade: samma navigering vid avslutad eller arkiverad granskning som under pågående granskning
        if (!is_first_requirement) {
            const prev_shortcut_key = 'shortcut_key_previous';
            const prev_btn = this.Helpers.create_element('button', {
                class_name: 'button button-secondary',
                html_content: `<span>${t(previous_text_key)}</span>` + this.Helpers.get_icon_svg('arrow_back', [], 18),
                attributes: {
                    'aria-keyshortcuts': aria_keyshortcuts(prev_shortcut_key),
                    'data-action': 'audit-nav-previous'
                }
            });
            if (previous_aria_label) {
                prev_btn.setAttribute('aria-label', previous_aria_label);
            }
            prev_btn.addEventListener('click', this.handle_prev_click);
            nav_group_right.appendChild(
                wrap_with_static_tooltip(
                    this.Helpers,
                    prev_btn,
                    `${t(previous_text_key)} (Shift+Alt+${shortcut_display(prev_shortcut_key)})`,
                    { use_overlay: false }
                )
            );
        }

        if (!is_last_requirement) {
            const next_shortcut_key = 'shortcut_key_next';
            const next_btn = this.Helpers.create_element('button', {
                class_name: 'button button-secondary',
                html_content: `<span>${t(next_text_key)}</span>` + this.Helpers.get_icon_svg('arrow_forward', [], 18),
                attributes: {
                    'aria-keyshortcuts': aria_keyshortcuts(next_shortcut_key),
                    'data-action': 'audit-nav-next'
                }
            });
            if (next_aria_label) {
                next_btn.setAttribute('aria-label', next_aria_label);
            }
            next_btn.addEventListener('click', this.handle_next_click);
            nav_group_right.appendChild(
                wrap_with_static_tooltip(
                    this.Helpers,
                    next_btn,
                    `${t(next_text_key)} (Shift+Alt+${shortcut_display(next_shortcut_key)})`,
                    { use_overlay: false }
                )
            );
        }

        const next_unhandled_req_key = this.AuditLogic.find_first_incomplete_requirement_key_for_sample(rule_file_content, sample_object, current_requirement_id);
        const should_show_next_unhandled = (typeof next_unhandled_available === 'boolean')
            ? next_unhandled_available
            : (next_unhandled_req_key !== null);
        if (should_show_next_unhandled) {
            const next_unhandled_shortcut_key = 'shortcut_key_next_unhandled';
            const next_unhandled_btn = this.Helpers.create_element('button', {
                class_name: 'button button-primary',
                html_content: `<span>${t(next_unhandled_text_key)}</span>` + this.Helpers.get_icon_svg('arrow_forward_alt', [], 18),
                attributes: {
                    'aria-keyshortcuts': aria_keyshortcuts(next_unhandled_shortcut_key),
                    'data-action': 'audit-nav-next-unhandled'
                }
            });
            if (next_unhandled_aria_label) {
                next_unhandled_btn.setAttribute('aria-label', next_unhandled_aria_label);
            }
            next_unhandled_btn.addEventListener('click', this.handle_next_unhandled_click);
            nav_group_right.appendChild(
                wrap_with_static_tooltip(
                    this.Helpers,
                    next_unhandled_btn,
                    `${t(next_unhandled_text_key)} (Shift+Alt+${shortcut_display(next_unhandled_shortcut_key)})`,
                    { use_overlay: false }
                )
            );
        }
        
        this.container_ref.appendChild(nav_group_left);
        if (nav_group_right.hasChildNodes()) {
            this.container_ref.appendChild(nav_group_right);
        }

        if (restore_focus_action) {
            const action = restore_focus_action;
            requestAnimationFrame(() => {
                const root = this.container_ref;
                if (!root) return;
                const btn = root.querySelector(`button[data-action="${CSS.escape(action)}"]`);
                if (btn && document.contains(btn)) {
                    try {
                        btn.focus({ preventScroll: true });
                    } catch (_) {
                        btn.focus();
                    }
                }
            });
        }
    }

    destroy() {
        if (this.container_ref) {
            // Remove all event listeners by cloning
            const buttons = this.container_ref.querySelectorAll('button');
            buttons.forEach(button => {
                button.replaceWith(button.cloneNode(true));
            });
            this.container_ref.innerHTML = '';
        }
        this.container_ref = null;
        this.on_navigate_callback = null;
        this.Translation = null;
        this.Helpers = null;
        this.AuditLogic = null;
    }
}
