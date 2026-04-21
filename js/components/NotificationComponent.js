import "./notification_component.css";
import { ensure_main_view_content_host } from '../logic/app_dom.js';

const GLOBAL_MESSAGE_CONTAINER_ID = 'global-message-area';
const GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID = 'global-critical-message-area';

export class NotificationComponent {
    constructor() {
        /** Fingeravtryck för senast dolda vanliga notisen – samma får inte visas igen förrän en annan notis visats. */
        this.regular_message_block_fp = null;
        /** Senast visade vanliga notis (sätts när något faktiskt renderats). */
        this.last_regular_shown_fp = null;
    }

    /**
     * @param {string} message
     * @param {string} [type]
     * @returns {string}
     */
    _fingerprint_regular_message(message, type) {
        const t = type && String(type).trim() !== '' ? String(type).trim() : 'info';
        const m = typeof message === 'string' ? message.trim() : '';
        return `${t}|${m}`;
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

        if (type === 'error' || type === 'warning' || is_critical) {
            element.setAttribute('role', 'alert');
        } else {
            element.removeAttribute('role');
        }

        if (!is_critical && message && message.trim() !== '') {
            const fp = this._fingerprint_regular_message(message, type);
            if (this.regular_message_block_fp && fp === this.regular_message_block_fp) {
                return;
            }
            if (this.regular_message_block_fp && fp !== this.regular_message_block_fp) {
                this.regular_message_block_fp = null;
            }
        }

        element.innerHTML = '';

        if (message && message.trim() !== '') {
            if (is_critical) {
                const textNode = document.createTextNode(message);
                element.appendChild(textNode);
                if (action && typeof action.callback === 'function') {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'global-message-action-btn button button-default';
                    btn.textContent = action.label || (typeof window.Translation?.t === 'function' ? window.Translation.t('ok') : 'Ok');
                    const clear_fn = this.clear_global_critical_message.bind(this);
                    btn.addEventListener('click', () => {
                        clear_fn();
                        action.callback();
                    });
                    element.appendChild(document.createTextNode(' '));
                    element.appendChild(btn);
                }
            } else {
                const text_wrap = document.createElement('span');
                text_wrap.className = 'global-message-text';
                text_wrap.textContent = message;
                element.appendChild(text_wrap);
                if (action && typeof action.callback === 'function') {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'global-message-action-btn';
                    btn.textContent = action.label || (typeof window.Translation?.t === 'function' ? window.Translation.t('ok') : 'Ok');
                    const clear_fn = this.clear_global_message.bind(this);
                    btn.addEventListener('click', () => {
                        clear_fn();
                        action.callback();
                    });
                    element.appendChild(btn);
                }
                const close_btn = document.createElement('button');
                close_btn.type = 'button';
                close_btn.className = 'global-message-close-btn';
                const close_label = typeof window.Translation?.t === 'function'
                    ? window.Translation.t('global_message_dismiss_aria_label')
                    : 'Stäng notisen';
                close_btn.setAttribute('aria-label', close_label);
                close_btn.appendChild(document.createTextNode('\u00D7'));
                close_btn.addEventListener('click', () => {
                    this.clear_global_message();
                });
                element.appendChild(close_btn);
            }
            element.className = '';
            element.classList.add('global-message-content');
            element.classList.add(`message-${type}`);

            element.removeAttribute('hidden');
            if (!is_critical) {
                this.last_regular_shown_fp = this._fingerprint_regular_message(message, type);
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
            const was_visible = !el.hidden && Boolean(this.last_regular_shown_fp);
            if (was_visible) {
                this.regular_message_block_fp = this.last_regular_shown_fp;
            }
            this.last_regular_shown_fp = null;
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
     * Tar bort dubletter av samma id (ska inte förekomma; lämnar kvar canonical-instanserna).
     * @param {HTMLElement} keep_critical
     * @param {HTMLElement} keep_regular
     */
    _remove_duplicate_global_message_nodes(keep_critical, keep_regular) {
        document.querySelectorAll(`[id="${GLOBAL_CRITICAL_MESSAGE_CONTAINER_ID}"]`).forEach((node) => {
            if (node !== keep_critical) {
                node.remove();
            }
        });
        document.querySelectorAll(`[id="${GLOBAL_MESSAGE_CONTAINER_ID}"]`).forEach((node) => {
            if (node !== keep_regular) {
                node.remove();
            }
        });
    }

    /**
     * Placerar kritisk + vanlig notis i #app-main-view-content som första barn, direkt ovanför vyns innehåll
     * (därmed ovanför h1#main-content-heading). Kritisk först, sedan vanlig.
     * Notiser som ligger någon annanstans flyttas hit; om main/värden saknas kopplas de från DOM.
     * @param {HTMLElement|null} [_ignored_legacy_container]
     */
    append_global_message_areas_to(_ignored_legacy_container) {
        const critical = this.get_global_critical_message_element_reference();
        const regular = this.get_global_message_element_reference();
        if (!critical || !regular) {
            return;
        }

        const main_el = document.getElementById('app-main-view-root');
        if (!main_el) {
            [critical, regular].forEach((el) => {
                if (el && el.isConnected) {
                    el.remove();
                }
            });
            return;
        }

        ensure_main_view_content_host(main_el);
        const host = main_el.querySelector('#app-main-view-content');
        if (!host) {
            [critical, regular].forEach((el) => {
                if (el && el.isConnected && !main_el.contains(el)) {
                    el.remove();
                }
            });
            return;
        }

        // Hitta första h1 inuti host, och placera notiserna direkt ovanför den
        const h1 = host.querySelector('h1');
        if (h1 && h1.parentNode) {
            h1.parentNode.insertBefore(critical, h1);
            h1.parentNode.insertBefore(regular, critical.nextSibling);
        } else {
            host.insertBefore(critical, host.firstChild);
            host.insertBefore(regular, critical.nextSibling);
        }

        this._remove_duplicate_global_message_nodes(critical, regular);
    }

    cleanup() {
        this.regular_message_block_fp = null;
        this.last_regular_shown_fp = null;
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