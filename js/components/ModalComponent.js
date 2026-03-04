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

    _is_word_char(ch) {
        if (!ch) return false;
        return /[A-Za-z0-9ÅÄÖåäö_]/.test(ch);
    },

    _is_single_quote_open(text, idx) {
        const prev = idx > 0 ? text[idx - 1] : '';
        const next = idx + 1 < text.length ? text[idx + 1] : '';
        if (this._is_word_char(prev)) return false;
        if (!next) return false;
        if (next === ' ' || next === '\n' || next === '\t') return false;
        return true;
    },

    _is_single_quote_close(text, idx) {
        const prev = idx > 0 ? text[idx - 1] : '';
        const next = idx + 1 < text.length ? text[idx + 1] : '';
        if (!prev || prev === ' ' || prev === '\n' || prev === '\t') return false;
        if (this._is_word_char(next)) return false;
        return true;
    },

    _find_next_quote_open(text, from_idx) {
        const idx_double = text.indexOf('"', from_idx);
        const idx_swedish = text.indexOf('”', from_idx);

        let idx_single = -1;
        for (let i = from_idx; i < text.length; i += 1) {
            if (text[i] === "'" && this._is_single_quote_open(text, i)) {
                idx_single = i;
                break;
            }
        }

        const candidates = [
            { idx: idx_double, ch: '"', kind: 'double' },
            { idx: idx_swedish, ch: '”', kind: 'swedish' },
            { idx: idx_single, ch: "'", kind: 'single' },
        ].filter(c => c.idx !== -1);

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => a.idx - b.idx);
        return candidates[0];
    },

    _find_single_quote_close(text, from_idx) {
        for (let i = from_idx; i < text.length; i += 1) {
            if (text[i] === "'" && this._is_single_quote_close(text, i)) return i;
        }
        return -1;
    },

    _tokenize_quoted_strong_parts(text) {
        const input = `${text ?? ''}`;
        if (!input) return [{ type: 'text', value: '' }];

        if (!input.includes('"') && !input.includes('”') && !input.includes("'")) {
            return [{ type: 'text', value: input }];
        }

        const parts = [];
        let cursor = 0;

        while (cursor < input.length) {
            const next_open = this._find_next_quote_open(input, cursor);
            if (!next_open) {
                parts.push({ type: 'text', value: input.slice(cursor) });
                break;
            }

            if (next_open.idx > cursor) {
                parts.push({ type: 'text', value: input.slice(cursor, next_open.idx) });
            }

            let close_idx = -1;
            if (next_open.kind === 'single') {
                close_idx = this._find_single_quote_close(input, next_open.idx + 1);
            } else {
                close_idx = input.indexOf(next_open.ch, next_open.idx + 1);
            }

            if (close_idx === -1) return null;

            const inner = input.slice(next_open.idx + 1, close_idx);
            if (inner) {
                parts.push({ type: 'strong', value: inner });
            }

            cursor = close_idx + 1;
        }

        return parts;
    },

    _transform_text_node_quotes_to_strong(text_node) {
        if (!text_node?.parentNode) return;
        const text = text_node.nodeValue ?? '';
        if (!text) return;
        if (!text.includes('"') && !text.includes('”') && !text.includes("'")) return;

        const parts = this._tokenize_quoted_strong_parts(text);
        if (!parts || parts.length === 0) return;
        if (parts.length === 1 && parts[0].type === 'text' && parts[0].value === text) return;

        const frag = document.createDocumentFragment();
        for (const part of parts) {
            if (!part?.value && part?.value !== '') continue;
            if (part.type === 'strong') {
                frag.appendChild(this.Helpers.create_element('strong', { text_content: part.value }));
            } else {
                frag.appendChild(document.createTextNode(part.value));
            }
        }

        text_node.parentNode.replaceChild(frag, text_node);
    },

    _transform_quotes_to_strong_in_container(container) {
        if (!container) return;
        if (!this.Helpers?.create_element) return;

        const excluded_tags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'PRE', 'CODE']);

        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node?.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (excluded_tags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
                    if (parent.closest && parent.closest('pre, code, textarea')) return NodeFilter.FILTER_REJECT;

                    const v = node.nodeValue ?? '';
                    if (!v) return NodeFilter.FILTER_REJECT;
                    if (!v.includes('"') && !v.includes('”') && !v.includes("'")) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodes = [];
        let n = walker.nextNode();
        while (n) {
            nodes.push(n);
            n = walker.nextNode();
        }

        for (const text_node of nodes) {
            this._transform_text_node_quotes_to_strong(text_node);
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

        this._transform_quotes_to_strong_in_container(this.content_container_ref);

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

        this._scroll_state = {
            windowY: window.scrollY,
            appContainer: null,
            mainViewRoot: null
        };
        const app_container = document.getElementById('app-container');
        const main_view_root = document.getElementById('app-main-view-root');
        if (app_container && app_container.scrollTop !== undefined) {
            this._scroll_state.appContainer = app_container.scrollTop;
        }
        if (main_view_root && main_view_root.scrollTop !== undefined) {
            this._scroll_state.mainViewRoot = main_view_root.scrollTop;
        }

        if (window.__GV_DEBUG_MODAL_SCROLL) {
            const debug_count = { n: 0 };
            this._debug_observer = new MutationObserver((mutations) => {
                debug_count.n += mutations.length;
                const has_structure = mutations.some(m => m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length));
                if (has_structure) {
                    const ac = document.getElementById('app-container');
                    const mvr = document.getElementById('app-main-view-root');
                    console.log('[GV-ModalDebug] DOM ändrad', {
                        mutations: debug_count.n,
                        scroll: { w: window.scrollY, ac: ac?.scrollTop, mvr: mvr?.scrollTop }
                    });
                }
            });
            this._debug_mutation_count = debug_count;
            const target = main_view_root || app_container;
            if (target) this._debug_observer.observe(target, { childList: true, subtree: true });
            console.log('[GV-ModalDebug] Modal ÖPPNAS – scroll:', this._scroll_state);
        }

        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._scroll_state.windowY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';

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

        const scroll_state = this._scroll_state || { windowY: 0, appContainer: null, mainViewRoot: null };
        this._scroll_state = null;

        const debug_observer = this._debug_observer;
        const debug_mutation_count = this._debug_mutation_count?.n ?? 0;

        if (window.__GV_DEBUG_MODAL_SCROLL) {
            console.log('[GV-ModalDebug] _finish_close – sparad scroll:', scroll_state);
            console.log('[GV-ModalDebug] _finish_close – scroll FÖRE cleanup:', {
                w: window.scrollY,
                ac: document.getElementById('app-container')?.scrollTop,
                mvr: document.getElementById('app-main-view-root')?.scrollTop
            });
        }

        const do_cleanup = () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            if (this.root && dialog.parentNode === this.root) {
                this.root.removeChild(dialog);
            }
            this.root?.setAttribute('aria-hidden', 'true');

            this.dialog_element_ref = null;
            this.content_container_ref = null;
            this.focus_before_open = null;
            this.pending_focus_element = null;
            this._debug_observer = null;

            const app_container = document.getElementById('app-container');
            const main_view_root = document.getElementById('app-main-view-root');
            if (app_container && scroll_state.appContainer !== null) {
                app_container.scrollTop = scroll_state.appContainer;
            }
            if (main_view_root && scroll_state.mainViewRoot !== null) {
                main_view_root.scrollTop = scroll_state.mainViewRoot;
            }

            window.scrollTo(0, scroll_state.windowY);
            document.documentElement.scrollTop = scroll_state.windowY;
            document.body.scrollTop = scroll_state.windowY;

            if (window.__GV_DEBUG_MODAL_SCROLL) {
                console.log('[GV-ModalDebug] Efter sync restore:', {
                    w: window.scrollY,
                    ac: app_container?.scrollTop,
                    mvr: main_view_root?.scrollTop
                });
            }

            requestAnimationFrame(() => {
                window.scrollTo(0, scroll_state.windowY);
                document.documentElement.scrollTop = scroll_state.windowY;
                document.body.scrollTop = scroll_state.windowY;
                if (app_container && scroll_state.appContainer !== null) {
                    app_container.scrollTop = scroll_state.appContainer;
                }
                if (main_view_root && scroll_state.mainViewRoot !== null) {
                    main_view_root.scrollTop = scroll_state.mainViewRoot;
                }
            });

            setTimeout(() => {
                window.scrollTo(0, scroll_state.windowY);
                document.documentElement.scrollTop = scroll_state.windowY;
                document.body.scrollTop = scroll_state.windowY;
                if (app_container && scroll_state.appContainer !== null) {
                    app_container.scrollTop = scroll_state.appContainer;
                }
                if (main_view_root && scroll_state.mainViewRoot !== null) {
                    main_view_root.scrollTop = scroll_state.mainViewRoot;
                }
                if (window.__GV_DEBUG_MODAL_SCROLL) {
                    console.log('[GV-ModalDebug] Efter setTimeout(0) restore:', {
                        w: window.scrollY,
                        ac: app_container?.scrollTop,
                        mvr: main_view_root?.scrollTop
                    });
                }
                requestAnimationFrame(() => {
                    if (focus_element && document.contains(focus_element)) {
                        try {
                            focus_element.focus({ preventScroll: true });
                        } catch (e) {
                            focus_element.focus();
                        }
                    }
                    if (window.__GV_DEBUG_MODAL_SCROLL) {
                        console.log('[GV-ModalDebug] Efter fokus:', {
                            w: window.scrollY,
                            ac: document.getElementById('app-container')?.scrollTop,
                            mvr: document.getElementById('app-main-view-root')?.scrollTop
                        });
                        if (debug_observer) {
                            debug_observer.disconnect();
                            console.log('[GV-ModalDebug] MutationObserver stoppad. Totalt mutationer:', debug_mutation_count);
                        }
                    }
                });
            });
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
