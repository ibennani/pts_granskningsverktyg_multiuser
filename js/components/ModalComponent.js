// js/components/ModalComponent.js

export const ModalComponent = {
    CSS_PATH: './css/components/modal_component.css',

    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;

        this.overlay_element_ref = null;
        this.dialog_element_ref = null;
        this.content_container_ref = null;
        this.focus_before_open = null;
        this.previous_focusable_refs = null;

        const self = this;
        this._bound_handle_escape_keydown = (event) => {
            if (!self.overlay_element_ref || !document.contains(self.overlay_element_ref)) return;
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            self.close();
        };
        this._bound_handle_focus_trap = (event) => {
            if (!self.overlay_element_ref || !document.contains(self.overlay_element_ref)) return;
            if (event.key !== 'Tab') return;
            const focusables = self.overlay_element_ref.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const focusable_list = Array.from(focusables).filter(el => !el.hasAttribute('aria-disabled'));
            if (focusable_list.length === 0) return;
            event.preventDefault();
            const first = focusable_list[0];
            const last = focusable_list[focusable_list.length - 1];
            const idx = focusable_list.indexOf(document.activeElement);
            if (event.shiftKey) {
                (idx <= 0 ? last : focusable_list[idx - 1]).focus();
            } else {
                (idx < 0 || idx >= focusable_list.length - 1 ? first : focusable_list[idx + 1]).focus();
            }
        };

        if (this.Helpers?.load_css_safely && this.CSS_PATH) {
            this.Helpers.load_css_safely(this.CSS_PATH, 'ModalComponent', {
                timeout: 5000,
                maxRetries: 2,
            }).catch(() => {
                console.warn('[ModalComponent] Continuing without CSS due to loading failure');
            });
        }
    },

    show({ h1_text, message_text }, content_callback) {
        if (!this.root || !this.Helpers?.create_element) return;

        this.focus_before_open = document.activeElement;

        this.overlay_element_ref = this.Helpers.create_element('div', {
            class_name: 'modal-overlay',
            attributes: {
                'role': 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'modal-dialog-title',
            },
        });

        this.dialog_element_ref = this.Helpers.create_element('div', {
            class_name: 'modal-dialog',
        });

        this.content_container_ref = this.Helpers.create_element('div', {
            class_name: 'modal-content',
            attributes: { id: 'modal-content-container' },
        });

        const heading = this.Helpers.create_element('h1', {
            id: 'modal-dialog-title',
            class_name: 'modal-heading',
            text_content: h1_text || '',
            attributes: { tabindex: '-1' },
        });
        this.content_container_ref.appendChild(heading);

        const message = this.Helpers.create_element('p', {
            class_name: 'modal-message',
            text_content: message_text || '',
        });
        this.content_container_ref.appendChild(message);

        if (typeof content_callback === 'function') {
            content_callback(this.content_container_ref, this);
        }

        this.dialog_element_ref.appendChild(this.content_container_ref);
        this.overlay_element_ref.appendChild(this.dialog_element_ref);

        const app_wrapper = document.getElementById('app-wrapper');
        if (app_wrapper) {
            app_wrapper.setAttribute('inert', '');
            app_wrapper.setAttribute('aria-hidden', 'true');
        }
        document.querySelectorAll('.skip-link').forEach((el) => el.setAttribute('aria-hidden', 'true'));

        this.root.appendChild(this.overlay_element_ref);
        this.root.setAttribute('aria-hidden', 'false');

        document.addEventListener('keydown', this._bound_handle_escape_keydown, true);
        document.addEventListener('keydown', this._bound_handle_focus_trap, true);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.overlay_element_ref.classList.add('modal-overlay--visible');
                heading.focus({ preventScroll: true });
            });
        });
    },

    close(focus_element_override) {
        if (!this.overlay_element_ref) return;

        const overlay = this.overlay_element_ref;
        this.overlay_element_ref = null;
        this.dialog_element_ref = null;

        document.removeEventListener('keydown', this._bound_handle_escape_keydown, true);
        document.removeEventListener('keydown', this._bound_handle_focus_trap, true);
        const focus_element = focus_element_override ?? this.focus_before_open;

        overlay.classList.remove('modal-overlay--visible');
        overlay.classList.add('modal-overlay--closing');

        const finish_close = () => {
            overlay.removeEventListener('transitionend', on_transition_end);
            clearTimeout(close_timeout);

            const app_wrapper = document.getElementById('app-wrapper');
            if (app_wrapper) {
                app_wrapper.removeAttribute('inert');
                app_wrapper.setAttribute('aria-hidden', 'false');
            }
            document.querySelectorAll('.skip-link').forEach((el) => el.setAttribute('aria-hidden', 'false'));

            if (this.root && overlay.parentNode === this.root) {
                this.root.removeChild(overlay);
            }
            this.root?.setAttribute('aria-hidden', 'true');

            this.content_container_ref = null;
            this.focus_before_open = null;

            if (focus_element && document.contains(focus_element)) {
                try {
                    focus_element.focus({ preventScroll: true });
                } catch (e) {
                    focus_element.focus();
                }
            }
        };

        const on_transition_end = (e) => {
            if (e.target === overlay && e.propertyName === 'opacity') {
                finish_close();
            }
        };

        overlay.addEventListener('transitionend', on_transition_end);
        const prefers_reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const close_timeout = setTimeout(finish_close, prefers_reduced_motion ? 50 : 200);
    },

    destroy() {
        if (this.overlay_element_ref && this.root?.contains(this.overlay_element_ref)) {
            this.close();
        } else {
            const app_wrapper = document.getElementById('app-wrapper');
            if (app_wrapper) {
                app_wrapper.removeAttribute('inert');
                app_wrapper.setAttribute('aria-hidden', 'false');
            }
            document.querySelectorAll('.skip-link').forEach((el) => el.setAttribute('aria-hidden', 'false'));
        }
        this.root = null;
        this.deps = null;
    },
};
