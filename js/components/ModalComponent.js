// js/components/ModalComponent.js

export const ModalComponent = {
    CSS_PATH: './css/components/modal_component.css',

    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;

        this.dialog_element_ref = null;
        this.content_container_ref = null;
        this.focus_before_open = null;
        this.pending_focus_element = null;
        this._bound_handle_close = null;
        this._bound_handle_cancel = null;

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
        this.pending_focus_element = null;

        this.dialog_element_ref = this.Helpers.create_element('dialog', {
            class_name: 'modal-dialog',
            attributes: {
                'aria-labelledby': 'modal-dialog-title',
            },
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

        this._bound_handle_close = () => this._finish_close();
        this._bound_handle_cancel = (e) => {
            e.preventDefault();
            this.close();
        };

        this.dialog_element_ref.addEventListener('close', this._bound_handle_close);
        this.dialog_element_ref.addEventListener('cancel', this._bound_handle_cancel);

        this.root.appendChild(this.dialog_element_ref);
        this.root.setAttribute('aria-hidden', 'false');

        this.dialog_element_ref.showModal();
        heading.focus({ preventScroll: true });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.dialog_element_ref.classList.add('modal-dialog--visible');
            });
        });
    },

    _finish_close() {
        const dialog = this.dialog_element_ref;
        if (!dialog) return;

        dialog.removeEventListener('close', this._bound_handle_close);
        dialog.removeEventListener('cancel', this._bound_handle_cancel);
        this._bound_handle_close = null;
        this._bound_handle_cancel = null;

        const focus_element = this.pending_focus_element ?? this.focus_before_open;

        const do_cleanup = () => {
            if (this.root && dialog.parentNode === this.root) {
                this.root.removeChild(dialog);
            }
            this.root?.setAttribute('aria-hidden', 'true');

            this.dialog_element_ref = null;
            this.content_container_ref = null;
            this.focus_before_open = null;
            this.pending_focus_element = null;

            if (focus_element && document.contains(focus_element)) {
                try {
                    focus_element.focus({ preventScroll: true });
                } catch (e) {
                    focus_element.focus();
                }
            }
        };

        do_cleanup();
    },

    _do_animated_close() {
        const dialog = this.dialog_element_ref;
        if (!dialog) return;

        const prefers_reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const transition_duration = prefers_reduced_motion ? 0 : 200;

        if (transition_duration > 0) {
            dialog.classList.remove('modal-dialog--visible');
            dialog.classList.add('modal-dialog--closing');

            const on_transition_end = (e) => {
                if (e.target === dialog && e.propertyName === 'opacity') {
                    dialog.removeEventListener('transitionend', on_transition_end);
                    clearTimeout(close_timeout);
                    dialog.close();
                }
            };
            dialog.addEventListener('transitionend', on_transition_end);
            const close_timeout = setTimeout(() => {
                dialog.removeEventListener('transitionend', on_transition_end);
                dialog.close();
            }, transition_duration + 50);
        } else {
            dialog.close();
        }
    },

    close(focus_element_override) {
        if (!this.dialog_element_ref) return;

        this.pending_focus_element = focus_element_override ?? this.focus_before_open;
        this._do_animated_close();
    },

    destroy() {
        if (this.dialog_element_ref && this.root?.contains(this.dialog_element_ref)) {
            this.close();
        }
        this.root = null;
        this.deps = null;
    },
};
