import "./notification_component.css";

const GLOBAL_MESSAGE_CONTAINER_ID = 'global-message-area';
const GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID = 'global-critical-message-area';

export const NotificationComponent = {
    init() {
        this.global_message_element = null;
        this.global_critical_message_element = null;

        // Defer DOM access
        return Promise.resolve().then(() => {
            this.global_critical_message_element = document.getElementById(GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID);
            if (!this.global_critical_message_element && window.Helpers && typeof window.Helpers.create_element === 'function') {
                this.global_critical_message_element = window.Helpers.create_element('div', {
                    id: GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID,
                    attributes: { 'aria-live': 'polite', hidden: 'true' }
                });
            } else if (this.global_critical_message_element && !this.global_critical_message_element.getAttribute('aria-live')) {
                this.global_critical_message_element.setAttribute('aria-live', 'polite');
            }

            this.global_message_element = document.getElementById(GLOBAL_MESSAGE_CONTAINER_ID);
            if (!this.global_message_element && window.Helpers && typeof window.Helpers.create_element === 'function') {
                this.global_message_element = window.Helpers.create_element('div', {
                    id: GLOBAL_MESSAGE_CONTAINER_ID,
                    attributes: { 'aria-live': 'polite', hidden: 'true' }
                });
            } else if (!window.Helpers && !this.global_message_element) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Helpers module not available to create message container.");
            } else if (this.global_message_element && !this.global_message_element.getAttribute('aria-live')) {
                this.global_message_element.setAttribute('aria-live', 'polite');
            }
        });
    },

    _ensure_message_element(which) {
        const id = which === 'critical' ? GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID : GLOBAL_MESSAGE_CONTAINER_ID;
        const ref = which === 'critical' ? 'global_critical_message_element' : 'global_message_element';
        if (!this[ref]) {
            if (window.Helpers && typeof window.Helpers.create_element === 'function' && !document.getElementById(id)) {
                this[ref] = window.Helpers.create_element('div', {
                    id,
                    attributes: { 'aria-live': 'polite', hidden: 'true' }
                });
            } else if (!document.getElementById(id)) {
                this[ref] = document.createElement('div');
                this[ref].id = id;
                this[ref].setAttribute('aria-live', 'polite');
                this[ref].hidden = true;
            } else {
                this[ref] = document.getElementById(id);
                if (this[ref] && !this[ref].getAttribute('aria-live')) {
                    this[ref].setAttribute('aria-live', 'polite');
                }
            }
        }
        return this[ref];
    },

    _update_global_message_content(message, type, action = null, is_critical = false) {
        const element = is_critical ? this._ensure_message_element('critical') : this._ensure_message_element('regular');
        if (!element) {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Cannot update message, core dependencies missing or element not ready.");
            return;
        }

        if (!element.getAttribute('aria-live')) {
            element.setAttribute('aria-live', 'polite');
        }

        if (type === 'error' || type === 'warning' || is_critical) {
            element.setAttribute('role', 'alert');
        } else {
            element.removeAttribute('role');
        }

        element.innerHTML = '';

        if (message && message.trim() !== '') {
            const textNode = document.createTextNode(message);
            element.appendChild(textNode);
            if (action && typeof action.callback === 'function') {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = is_critical ? 'global-message-action-btn button button-default' : 'global-message-action-btn';
                btn.textContent = action.label || (typeof window.Translation?.t === 'function' ? window.Translation.t('ok') : 'Ok');
                const clear_fn = is_critical ? this.clear_global_critical_message.bind(this) : this.clear_global_message.bind(this);
                btn.addEventListener('click', () => {
                    clear_fn();
                    action.callback();
                });
                element.appendChild(document.createTextNode(' '));
                element.appendChild(btn);
            }
            element.className = '';
            element.classList.add('global-message-content');
            element.classList.add(`message-${type}`);

            element.removeAttribute('hidden');
        } else {
            if (is_critical) {
                /* Kritisk meddelanderuta (ny version / ny regelfil) rensas endast när användaren klickar på knappen – aldrig vid tom uppdatering. */
            } else {
                this.clear_global_message();
            }
        }
    },

    show_global_message(message, type = 'info', _duration, action) {
        if (!this.global_message_element) {
            this.init().then(() => {
                if (this.global_message_element) this._update_global_message_content(message, type, action || null, false);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action || null, false);
    },

    show_global_message_with_action(message, type = 'info', action) {
        if (!this.global_message_element) {
            this.init().then(() => {
                if (this.global_message_element) this._update_global_message_content(message, type, action, false);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action, false);
    },

    show_global_critical_message(message, type = 'warning', action = null) {
        if (!this.global_critical_message_element) {
            this.init().then(() => {
                if (this.global_critical_message_element) this._update_global_message_content(message, type, action, true);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show critical message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action, true);
    },

    show_global_critical_message_with_action(message, type = 'warning', action) {
        if (!this.global_critical_message_element) {
            this.init().then(() => {
                if (this.global_critical_message_element) this._update_global_message_content(message, type, action, true);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show critical message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action, true);
    },

    clear_global_message() {
        if (this.global_message_element) {
            this.global_message_element.textContent = '';
            this.global_message_element.setAttribute('hidden', 'true');
            this.global_message_element.className = 'global-message-content';
            this.global_message_element.removeAttribute('role');
        }
    },

    clear_global_critical_message() {
        if (this.global_critical_message_element) {
            this.global_critical_message_element.textContent = '';
            this.global_critical_message_element.setAttribute('hidden', 'true');
            this.global_critical_message_element.className = 'global-message-content';
            this.global_critical_message_element.removeAttribute('role');
        }
    },

    get_global_critical_message_element_reference() {
        return this._ensure_message_element('critical');
    },

    get_global_message_element_reference() {
        return this._ensure_message_element('regular');
    },

    append_global_message_areas_to(container) {
        if (!container) return;
        const critical = this.get_global_critical_message_element_reference();
        const regular = this.get_global_message_element_reference();
        if (critical && !container.contains(critical)) {
            container.appendChild(critical);
        }
        if (regular && !container.contains(regular)) {
            container.appendChild(regular);
        }
    },

    cleanup() {
        if (this.global_message_element) {
            this.global_message_element.innerHTML = '';
            this.global_message_element = null;
        }
        if (this.global_critical_message_element) {
            this.global_critical_message_element.innerHTML = '';
            this.global_critical_message_element = null;
        }
    }
};