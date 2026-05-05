/**
 * Knapp som kopierar absolut URL för aktuell vy (inkl. filter i URL där det stöds).
 */
import { build_absolute_shareable_url } from '../logic/shareable_app_location.js';
import { get_current_view_name, get_current_view_params_json } from '../app/browser_globals.js';
import './copy_view_link_component.css';

export class CopyViewLinkComponent {
    constructor() {
        this.CSS_PATH = './copy_view_link_component.css';
        this.root = null;
        this.getState = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this._unsubscribe = null;
        this._bound_render = null;
        this._bound_click = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this._bound_click = () => this.handle_click();
        this._bound_render = () => this.render();

        if (this.Helpers?.load_css_safely && CopyViewLinkComponent.CSS_PATH) {
            await this.Helpers.load_css_safely(CopyViewLinkComponent.CSS_PATH, 'CopyViewLinkComponent').catch(() => {});
        }

        if (typeof deps.subscribe === 'function') {
            this._unsubscribe = deps.subscribe((_s, meta) => {
                if (meta?.skip_render) return;
                this.render();
            });
        }
        this.render();
    }

    async handle_click() {
        const t = this.Translation?.t?.bind?.(this.Translation) || ((x) => x);
        const view_name = get_current_view_name();
        if (!view_name || view_name === 'login') return;

        let params = {};
        try {
            params = JSON.parse(get_current_view_params_json() || '{}');
        } catch {
            params = {};
        }
        /** @type {Record<string,string>} */
        const flat = {};
        for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null) continue;
            flat[k] = String(v);
        }
        const url = build_absolute_shareable_url(view_name, flat, this.getState);

        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                throw new Error('clipboard_unavailable');
            }
            const announcer = typeof document !== 'undefined' ? document.getElementById('gv-copy-link-status') : null;
            const msg_ok = t('copy_view_link_success');
            if (announcer) {
                announcer.textContent = '';
                window.requestAnimationFrame(() => {
                    announcer.textContent = msg_ok;
                });
            }
            this.NotificationComponent?.show_global_message?.(msg_ok, 'success');
        } catch {
            const msg_err = t('copy_view_link_error');
            const announcer = typeof document !== 'undefined' ? document.getElementById('gv-copy-link-status') : null;
            if (announcer) {
                announcer.textContent = '';
                window.requestAnimationFrame(() => {
                    announcer.textContent = msg_err;
                });
            }
            this.NotificationComponent?.show_global_message?.(msg_err, 'error');
        }
    }

    render() {
        if (!this.root || !this.Helpers?.create_element || !this.Translation?.t) return;

        const view_name = typeof get_current_view_name === 'function' ? get_current_view_name() : '';

        const active_el = typeof document !== 'undefined' ? document.activeElement : null;
        const was_btn = Boolean(active_el && active_el.id === 'gv-copy-view-link-button');

        this.root.innerHTML = '';

        if (!view_name || view_name === 'login') return;

        const t = this.Translation.t.bind(this.Translation);

        const status_live = this.Helpers.create_element('div', {
            attributes: {
                role: 'status',
                id: 'gv-copy-link-status',
                'aria-live': 'polite',
                class: 'visually-hidden'
            }
        });

        const btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'gv-copy-view-link-btn'],
            attributes: { type: 'button', id: 'gv-copy-view-link-button' },
            text_content: t('copy_view_link_label')
        });
        btn.addEventListener('click', this._bound_click);

        this.root.appendChild(status_live);
        this.root.appendChild(btn);

        if (was_btn) {
            requestAnimationFrame(() => {
                const b = document.getElementById('gv-copy-view-link-button');
                if (b?.focus) {
                    try {
                        b.focus({ preventScroll: true });
                    } catch {
                        b.focus();
                    }
                }
            });
        }
    }

    destroy() {
        if (typeof this._unsubscribe === 'function') {
            this._unsubscribe();
            this._unsubscribe = null;
        }
        this._bound_click = null;
        this._bound_render = null;
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.getState = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
    }
}
