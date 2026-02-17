// js/components/requirement_audit/RequirementAuditNavigation.js

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
            is_audit_locked,
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
        const back_wrapper = this.Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
        const back_tooltip = this.Helpers.create_element('span', {
            class_name: 'status-icon-tooltip',
            text_content: `${t('back_to_requirement_list')} (Shift+Alt+${shortcut_display(back_key)})`,
            attributes: { 'aria-hidden': 'true' }
        });
        back_wrapper.appendChild(back_btn);
        back_wrapper.appendChild(back_tooltip);
        nav_group_left.appendChild(back_wrapper);

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

        if (!is_audit_locked) {
            // Previous button
            if (!is_first_requirement) {
                const prev_shortcut_key = 'shortcut_key_previous';
                const prev_btn = this.Helpers.create_element('button', {
                    class_name: 'button button-secondary',
                    html_content: `<span>${t(previous_text_key)}</span>` + this.Helpers.get_icon_svg('arrow_back', [], 18),
                    attributes: { 'aria-keyshortcuts': aria_keyshortcuts(prev_shortcut_key) }
                });
                if (previous_aria_label) {
                    prev_btn.setAttribute('aria-label', previous_aria_label);
                }
                prev_btn.addEventListener('click', this.handle_prev_click);
                const prev_wrapper = this.Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
                const prev_tooltip = this.Helpers.create_element('span', {
                    class_name: 'status-icon-tooltip',
                    text_content: `${t(previous_text_key)} (Shift+Alt+${shortcut_display(prev_shortcut_key)})`,
                    attributes: { 'aria-hidden': 'true' }
                });
                prev_wrapper.appendChild(prev_btn);
                prev_wrapper.appendChild(prev_tooltip);
                nav_group_right.appendChild(prev_wrapper);
            }

            // Next button
            if (!is_last_requirement) {
                const next_shortcut_key = 'shortcut_key_next';
                const next_btn = this.Helpers.create_element('button', {
                    class_name: 'button button-secondary',
                    html_content: `<span>${t(next_text_key)}</span>` + this.Helpers.get_icon_svg('arrow_forward', [], 18),
                    attributes: { 'aria-keyshortcuts': aria_keyshortcuts(next_shortcut_key) }
                });
                if (next_aria_label) {
                    next_btn.setAttribute('aria-label', next_aria_label);
                }
                next_btn.addEventListener('click', this.handle_next_click);
                const next_wrapper = this.Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
                const next_tooltip = this.Helpers.create_element('span', {
                    class_name: 'status-icon-tooltip',
                    text_content: `${t(next_text_key)} (Shift+Alt+${shortcut_display(next_shortcut_key)})`,
                    attributes: { 'aria-hidden': 'true' }
                });
                next_wrapper.appendChild(next_btn);
                next_wrapper.appendChild(next_tooltip);
                nav_group_right.appendChild(next_wrapper);
            }

            // Next unhandled button
            const next_unhandled_req_key = this.AuditLogic.find_first_incomplete_requirement_key_for_sample(rule_file_content, sample_object, current_requirement_id);
            const should_show_next_unhandled = (typeof next_unhandled_available === 'boolean')
                ? next_unhandled_available
                : (next_unhandled_req_key !== null);
            if (should_show_next_unhandled) {
                const next_unhandled_shortcut_key = 'shortcut_key_next_unhandled';
                const next_unhandled_btn = this.Helpers.create_element('button', {
                    class_name: 'button button-primary',
                    html_content: `<span>${t(next_unhandled_text_key)}</span>` + this.Helpers.get_icon_svg('arrow_forward_alt', [], 18),
                    attributes: { 'aria-keyshortcuts': aria_keyshortcuts(next_unhandled_shortcut_key) }
                });
                if (next_unhandled_aria_label) {
                    next_unhandled_btn.setAttribute('aria-label', next_unhandled_aria_label);
                }
                next_unhandled_btn.addEventListener('click', this.handle_next_unhandled_click);
                const next_unhandled_wrapper = this.Helpers.create_element('span', { class_name: 'status-icon-tooltip-wrapper' });
                const next_unhandled_tooltip = this.Helpers.create_element('span', {
                    class_name: 'status-icon-tooltip',
                    text_content: `${t(next_unhandled_text_key)} (Shift+Alt+${shortcut_display(next_unhandled_shortcut_key)})`,
                    attributes: { 'aria-hidden': 'true' }
                });
                next_unhandled_wrapper.appendChild(next_unhandled_btn);
                next_unhandled_wrapper.appendChild(next_unhandled_tooltip);
                nav_group_right.appendChild(next_unhandled_wrapper);
            }
        }
        
        this.container_ref.appendChild(nav_group_left);
        if (nav_group_right.hasChildNodes()) {
            this.container_ref.appendChild(nav_group_right);
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
