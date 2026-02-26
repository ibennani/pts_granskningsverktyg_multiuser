import "../../css/components/notification_component.css";

const GLOBAL_MESSAGE_CONTAINER_ID = 'global-message-area';

export const NotificationComponent = {
    init() {
        this.global_message_element = null;

        // Defer DOM access
        return Promise.resolve().then(() => {
            this.global_message_element = document.getElementById(GLOBAL_MESSAGE_CONTAINER_ID);
            if (!this.global_message_element && window.Helpers && typeof window.Helpers.create_element === 'function') {
                this.global_message_element = window.Helpers.create_element('div', {
                    id: GLOBAL_MESSAGE_CONTAINER_ID,
                    attributes: { 'aria-live': 'polite', hidden: 'true' }
                });
            } else if (!window.Helpers && !this.global_message_element) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Helpers module not available to create message container.");
            } else if (this.global_message_element) {
                // Säkerställ att aria-live alltid finns på elementet
                if (!this.global_message_element.getAttribute('aria-live')) {
                    this.global_message_element.setAttribute('aria-live', 'polite');
                }
            }
        });
    },

    _update_global_message_content(message, type, action = null) {
        if (!this.global_message_element) {
            // Try to get element if it was created after init
            this.global_message_element = document.getElementById(GLOBAL_MESSAGE_CONTAINER_ID);
            if (!this.global_message_element) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Cannot update message, core dependencies missing or element not ready.");
                return;
            }
        }
        
        // Säkerställ att aria-live alltid finns på elementet
        if (!this.global_message_element.getAttribute('aria-live')) {
            this.global_message_element.setAttribute('aria-live', 'polite');
        }
        
        // Sätt role="alert" INNAN innehållet ändras för error/warning
        // Detta säkerställer att skärmläsare meddelar ändringen korrekt
        if (type === 'error' || type === 'warning') {
            this.global_message_element.setAttribute('role', 'alert');
        } else {
            this.global_message_element.removeAttribute('role');
        }

        this.global_message_element.innerHTML = '';

        if (message && message.trim() !== '') {
            const textNode = document.createTextNode(message);
            this.global_message_element.appendChild(textNode);
            if (action && typeof action.callback === 'function') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'global-message-action-btn';
                btn.textContent = action.label || (typeof window.Translation?.t === 'function' ? window.Translation.t('ok') : 'Ok');
                btn.addEventListener('click', () => {
                    this.clear_global_message();
                    action.callback();
                });
                this.global_message_element.appendChild(document.createTextNode(' '));
                this.global_message_element.appendChild(btn);
            }
            this.global_message_element.className = '';
            this.global_message_element.classList.add('global-message-content');
            this.global_message_element.classList.add(`message-${type}`);

            this.global_message_element.removeAttribute('hidden');
        } else {
            this.clear_global_message();
        }
    },

    show_global_message(message, type = 'info', _duration, action) {
        if (!this.global_message_element) {
            this.init().then(() => { 
                if (this.global_message_element) this._update_global_message_content(message, type, action || null);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action || null);
    },

    show_global_message_with_action(message, type = 'info', action) {
        if (!this.global_message_element) {
            this.init().then(() => { 
                if (this.global_message_element) this._update_global_message_content(message, type, action);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action);
    },

    clear_global_message() {
        if (this.global_message_element) {
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
        if (this.global_message_element) {
            this.global_message_element.innerHTML = '';
            this.global_message_element = null;
        }
    }
};