import "./notification_component.css";
import {
    create_notification_dedupe_state,
    should_skip_regular_message_display,
    mark_regular_message_shown,
    apply_clear_regular_message,
    reset_notification_dedupe_state
} from '../notifications/notification_state.js';
import {
    mount_critical_message_dom,
    mount_regular_message_dom,
    apply_visible_message_presentation
} from '../notifications/notification_renderer.js';
import {
    append_global_message_areas_to_host,
    GLOBAL_MESSAGE_CONTAINER_ID,
    GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID
} from '../notifications/notification_portal.js';

export class NotificationComponent {
    constructor() {
        this._dedupe = create_notification_dedupe_state();
    }

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
    }

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
    }

    _update_global_message_content(message, type, action = null, is_critical = false) {
        /** Montera notisytorna i värden (#app-main-view-content) ovanför vyns h1 innan innehåll sätts. */
        this.append_global_message_areas_to(null);
        const element = is_critical ? this._ensure_message_element('critical') : this._ensure_message_element('regular');
        if (!element) {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Cannot update message, core dependencies missing or element not ready.");
            return;
        }

        if (!element.getAttribute('aria-live')) {
            element.setAttribute('aria-live', 'polite');
        }

        if (!is_critical && message && message.trim() !== '') {
            if (should_skip_regular_message_display(this._dedupe, message, type)) {
                return;
            }
        }

        element.innerHTML = '';

        if (message && message.trim() !== '') {
            if (is_critical) {
                const clear_critical = this.clear_global_critical_message.bind(this);
                mount_critical_message_dom(element, message, action, () => {
                    clear_critical();
                    if (action && typeof action.callback === 'function') {
                        action.callback();
                    }
                });
            } else {
                const clear_regular = this.clear_global_message.bind(this);
                mount_regular_message_dom(
                    element,
                    message,
                    action,
                    () => {
                        clear_regular();
                        if (action && typeof action.callback === 'function') {
                            action.callback();
                        }
                    },
                    () => {
                        this.clear_global_message();
                    }
                );
            }
            apply_visible_message_presentation(element, type, is_critical);
            if (!is_critical) {
                mark_regular_message_shown(this._dedupe, message, type);
            }
        } else {
            if (is_critical) {
                /* Kritisk meddelanderuta (ny version / ny regelfil) rensas endast när användaren klickar på knappen – aldrig vid tom uppdatering. */
            } else {
                this.clear_global_message();
            }
        }
    }

    show_global_message(message, type = 'info', _duration, action) {
        if (!this.global_message_element) {
            this.init().then(() => {
                if (this.global_message_element) this._update_global_message_content(message, type, action || null, false);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action || null, false);
    }

    show_global_message_with_action(message, type = 'info', action) {
        if (!this.global_message_element) {
            this.init().then(() => {
                if (this.global_message_element) this._update_global_message_content(message, type, action, false);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action, false);
    }

    show_global_critical_message(message, type = 'warning', action = null) {
        if (!this.global_critical_message_element) {
            this.init().then(() => {
                if (this.global_critical_message_element) this._update_global_message_content(message, type, action, true);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show critical message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action, true);
    }

    show_global_critical_message_with_action(message, type = 'warning', action) {
        if (!this.global_critical_message_element) {
            this.init().then(() => {
                if (this.global_critical_message_element) this._update_global_message_content(message, type, action, true);
                else if (window.ConsoleManager?.warn) window.ConsoleManager.warn("NotificationComponent: Still cannot show critical message, container not established after re-init.");
            });
            return;
        }
        this._update_global_message_content(message, type, action, true);
    }

    clear_global_message() {
        if (this.global_message_element) {
            const el = this.global_message_element;
            const was_visible = !el.hidden && Boolean(this._dedupe.last_regular_shown_fp);
            apply_clear_regular_message(this._dedupe, was_visible);
            el.textContent = '';
            el.setAttribute('hidden', 'true');
            el.className = 'global-message-content';
            el.removeAttribute('role');
        }
    }

    clear_global_critical_message() {
        if (this.global_critical_message_element) {
            this.global_critical_message_element.textContent = '';
            this.global_critical_message_element.setAttribute('hidden', 'true');
            this.global_critical_message_element.className = 'global-message-content';
            this.global_critical_message_element.removeAttribute('role');
        }
    }

    get_global_critical_message_element_reference() {
        return this._ensure_message_element('critical');
    }

    get_global_message_element_reference() {
        return this._ensure_message_element('regular');
    }

    /**
     * Placerar kritisk + vanlig notis i #app-main-view-content som första barn, direkt ovanför vyns innehåll
     * (därmed ovanför h1#main-content-heading). Kritisk först, sedan vanlig.
     * Notiser som ligger någon annanstans flyttas hit; om main/värden saknas kopplas de från DOM.
     * @param {HTMLElement|null} [_ignored_legacy_container]
     */
    append_global_message_areas_to(_ignored_legacy_container) {
        append_global_message_areas_to_host(
            this.get_global_critical_message_element_reference(),
            this.get_global_message_element_reference()
        );
    }

    cleanup() {
        reset_notification_dedupe_state(this._dedupe);
        if (this.global_message_element) {
            this.global_message_element.innerHTML = '';
            this.global_message_element = null;
        }
        if (this.global_critical_message_element) {
            this.global_critical_message_element.innerHTML = '';
            this.global_critical_message_element = null;
        }
    }
}