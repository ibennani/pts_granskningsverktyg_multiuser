/**
 * @file Högerspalt med lista över tidigare AI-chattar.
 */

import type { AiChatSession } from '../logic/ai_chat_history.ts';
import { build_compact_hash_fragment } from '../logic/router_url_codec.js';
import './ai_chat_history_sidebar_component.css';

interface SidebarDeps {
    router: (view: string, params?: Record<string, string>, opts?: { replace_state?: boolean }) => void;
    Translation: { t: (key: string) => string };
    Helpers: {
        create_element: (
            tag: string,
            options?: {
                class_name?: string | string[];
                text_content?: string;
                attributes?: Record<string, string>;
            }
        ) => HTMLElement;
        load_css?: (path: string) => Promise<void>;
        load_css_safely?: (path: string) => Promise<void>;
    };
}

export class AiChatHistorySidebarComponent {
    CSS_PATH = './ai_chat_history_sidebar_component.css';
    root: HTMLElement | null = null;
    deps: SidebarDeps | null = null;
    Helpers: SidebarDeps['Helpers'] | null = null;
    Translation: SidebarDeps['Translation'] | null = null;
    router: SidebarDeps['router'] | null = null;
    _handle_link_click = (event: Event) => {
        event.preventDefault();
        const target = event.currentTarget as HTMLAnchorElement | null;
        const chat_id = target?.getAttribute('data-chat-id');
        if (!chat_id || !this.router) return;
        this.router('ai_chat', { chatId: chat_id });
    };

    async init({ root, deps }: { root: HTMLElement; deps: SidebarDeps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.router = deps.router;
        if (this.Helpers?.load_css_safely) {
            await this.Helpers.load_css_safely(this.CSS_PATH).catch(() => {});
        } else if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    }

    _t(key: string): string {
        return this.Translation?.t?.(key) ?? key;
    }

    render({ sessions, active_chat_id }: { sessions: AiChatSession[]; active_chat_id: string | null }) {
        if (!this.root || !this.Helpers) return;
        this.root.innerHTML = '';

        const panel = this.Helpers.create_element('div', { class_name: 'ai-chat-history-sidebar' });
        panel.appendChild(
            this.Helpers.create_element('h1', {
                attributes: { id: 'ai-chat-history-title' },
                text_content: this._t('ai_chat_history_title')
            })
        );

        const list = this.Helpers.create_element('ul', {
            class_name: 'ai-chat-history-sidebar__list',
            attributes: { 'aria-labelledby': 'ai-chat-history-title' }
        });

        sessions.forEach((session) => {
            const item = this.Helpers!.create_element('li', { class_name: 'ai-chat-history-sidebar__item' });
            const href = `#${build_compact_hash_fragment('ai_chat', { chatId: session.id })}`;
            const link_attrs: Record<string, string> = {
                href,
                'data-chat-id': session.id
            };
            if (active_chat_id && session.id === active_chat_id) {
                link_attrs['aria-current'] = 'page';
            }
            const link = this.Helpers!.create_element('a', {
                class_name: 'ai-chat-history-sidebar__link',
                text_content: session.title,
                attributes: link_attrs
            });
            link.addEventListener('click', this._handle_link_click);
            item.appendChild(link);
            list.appendChild(item);
        });

        panel.appendChild(list);
        this.root.appendChild(panel);
    }

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.router = null;
    }
}
