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

        this.handle_backdrop_keydown = this.handle_backdrop_keydown.bind(this);
        this.handle_focus_trap = this.handle_focus_trap.bind(this);

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
        }

        this.root.appendChild(this.overlay_element_ref);
        this.root.setAttribute('aria-hidden', 'false');

        this.overlay_element_ref.addEventListener('keydown', this.handle_backdrop_keydown);
        document.addEventListener('keydown', this.handle_focus_trap, true);

        const first_focusable = this.overlay_element_ref.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (first_focusable) {
            requestAnimationFrame(() => first_focusable.focus());
        } else {
            this.dialog_element_ref.setAttribute('tabindex', '-1');
            requestAnimationFrame(() => this.dialog_element_ref.focus());
        }
    },

    close(focus_element_override) {
        if (!this.overlay_element_ref) return;

        this.overlay_element_ref.removeEventListener('keydown', this.handle_backdrop_keydown);
        document.removeEventListener('keydown', this.handle_focus_trap, true);

        const app_wrapper = document.getElementById('app-wrapper');
        if (app_wrapper) {
            app_wrapper.removeAttribute('inert');
        }

        this.root.removeChild(this.overlay_element_ref);
        this.root.setAttribute('aria-hidden', 'true');

        this.overlay_element_ref = null;
        this.dialog_element_ref = null;
        this.content_container_ref = null;

        const element_to_focus = focus_element_override ?? this.focus_before_open;
        if (element_to_focus && document.contains(element_to_focus)) {
            try {
                element_to_focus.focus({ preventScroll: true });
            } catch (e) {
                element_to_focus.focus();
            }
        }
        this.focus_before_open = null;
    },

    handle_backdrop_keydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
        }
    },

    handle_focus_trap(event) {
        if (!this.overlay_element_ref || !document.contains(this.overlay_element_ref)) return;
        if (this.overlay_element_ref.contains(document.activeElement)) return;

        if (event.key !== 'Tab') return;

        const focusables = this.overlay_element_ref.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusable_list = Array.from(focusables).filter(el => !el.hasAttribute('aria-disabled'));

        if (focusable_list.length === 0) return;

        event.preventDefault();

        const first = focusable_list[0];
        const last = focusable_list[focusable_list.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === first) {
                last.focus();
            } else {
                const idx = focusable_list.indexOf(document.activeElement);
                const prev = focusable_list[idx - 1] || last;
                prev.focus();
            }
        } else {
            if (document.activeElement === last) {
                first.focus();
            } else {
                const idx = focusable_list.indexOf(document.activeElement);
                const next = focusable_list[idx + 1] || first;
                next.focus();
            }
        }
    },

    destroy() {
        if (this.overlay_element_ref && this.root?.contains(this.overlay_element_ref)) {
            this.close();
        }
        const app_wrapper = document.getElementById('app-wrapper');
        if (app_wrapper) {
            app_wrapper.removeAttribute('inert');
        }
        this.root = null;
        this.deps = null;
    },
};
