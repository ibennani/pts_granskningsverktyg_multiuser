import "../../css/components/notification_component.css";

const GLOBAL_MESSAGE_CONTAINER_ID = 'global-message-area';

export const NotificationComponent = {
    init() {
        this.global_message_element = null;
        this.event_listeners = new Set(); 
        
        // Defer DOM access
        return Promise.resolve().then(() => {
            this.global_message_element = document.getElementById(GLOBAL_MESSAGE_CONTAINER_ID);
            if (!this.global_message_element && window.Helpers && typeof window.Helpers.create_element === 'function') {
                this.global_message_element = window.Helpers.create_element('div', {
                    id: GLOBAL_MESSAGE_CONTAINER_ID,
                    attributes: { 'aria-live': 'polite', hidden: 'true' }
                });
            } else if (!window.Helpers && !this.global_message_element) {
                console.error("NotificationComponent: Helpers module not available to create message container.");
            } else if (this.global_message_element) {
                // Säkerställ att aria-live alltid finns på elementet
                if (!this.global_message_element.getAttribute('aria-live')) {
                    this.global_message_element.setAttribute('aria-live', 'polite');
                }
            }
        });
    },

    _update_global_message_content(message, type) {
        if (!this.event_listeners) {
            this.event_listeners = new Set();
        }

        if (!this.global_message_element || !window.Translation || !window.Helpers) {
            // Try to get element if it was created after init
            this.global_message_element = document.getElementById(GLOBAL_MESSAGE_CONTAINER_ID);
            if (!this.global_message_element) {
                console.error("NotificationComponent: Cannot update message, core dependencies missing or element not ready.");
                return;
            }
        }
        
        // Säkerställ att aria-live alltid finns på elementet
        if (!this.global_message_element.getAttribute('aria-live')) {
            this.global_message_element.setAttribute('aria-live', 'polite');
        }
        
        const { t } = window.Translation;
        const { create_element } = window.Helpers;

        // Sätt role="alert" INNAN innehållet ändras för error/warning
        // Detta säkerställer att skärmläsare meddelar ändringen korrekt
        if (type === 'error' || type === 'warning') {
            this.global_message_element.setAttribute('role', 'alert');
        } else {
            this.global_message_element.removeAttribute('role');
        }

        this.global_message_element.innerHTML = '';

        if (message && message.trim() !== '') {
            this.global_message_element.textContent = message;
            this.global_message_element.className = '';
            this.global_message_element.classList.add('global-message-content');
            this.global_message_element.classList.add(`message-${type}`);

            if (type === 'error' || type === 'warning') {
                const close_button = create_element('button', {
                    class_name: 'global-message-close-btn', html_content: '×',
                    attributes: { 'aria-label': t('close') }
                });
                const closeHandler = () => this.clear_global_message();
                close_button.addEventListener('click', closeHandler, { once: true });
                // Track the event listener for cleanup
                this.event_listeners.add({ element: close_button, event: 'click', handler: closeHandler });
                this.global_message_element.appendChild(close_button);
            }
            this.global_message_element.removeAttribute('hidden');
        } else {
            this.clear_global_message();
        }
    },

    show_global_message(message, type = 'info') {
        if (!this.global_message_element) {
            this.init().then(() => { 
                if(this.global_message_element) this._update_global_message_content(message, type);
                else console.error("NotificationComponent: Still cannot show message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type);
    },

    clear_global_message() {
        if (this.global_message_element) {
            // Clean up any existing event listeners
            const btn = this.global_message_element.querySelector('.global-message-close-btn');
            if(btn) {
                // Remove from tracked listeners
                for (const listener of this.event_listeners) {
                    if (listener.element === btn) {
                        btn.removeEventListener(listener.event, listener.handler);
                        this.event_listeners.delete(listener);
                    }
                }
                btn.remove();
            }
            
            this.global_message_element.textContent = '';
            this.global_message_element.setAttribute('hidden', 'true');
            this.global_message_element.className = 'global-message-content';
            this.global_message_element.removeAttribute('role');
        }
    },

    get_global_message_element_reference() {
        if (!this.global_message_element) {
            if (window.Helpers && typeof window.Helpers.create_element === 'function' && !document.getElementById(GLOBAL_MESSAGE_CONTAINER_ID)) {
                 this.global_message_element = window.Helpers.create_element('div', {
                    id: GLOBAL_MESSAGE_CONTAINER_ID,
                    attributes: { 'aria-live': 'polite', hidden: 'true' }
                });
            } else if (!document.getElementById(GLOBAL_MESSAGE_CONTAINER_ID)) {
                this.global_message_element = document.createElement('div');
                this.global_message_element.id = GLOBAL_MESSAGE_CONTAINER_ID;
                this.global_message_element.setAttribute('aria-live', 'polite');
                this.global_message_element.hidden = true;
            } else {
                 this.global_message_element = document.getElementById(GLOBAL_MESSAGE_CONTAINER_ID);
                 // Säkerställ att aria-live alltid finns på elementet
                 if (this.global_message_element && !this.global_message_element.getAttribute('aria-live')) {
                     this.global_message_element.setAttribute('aria-live', 'polite');
                 }
            }
        }
        return this.global_message_element;
    },

    cleanup() {
        // Clean up all tracked event listeners
        if (this.event_listeners) {
            for (const listener of this.event_listeners) {
                if (listener.element && listener.element.removeEventListener) {
                    listener.element.removeEventListener(listener.event, listener.handler);
                }
            }
            this.event_listeners.clear();
        }
        
        // Clear global message element reference
        if (this.global_message_element) {
            this.global_message_element.innerHTML = '';
            this.global_message_element = null;
        }
    }
};