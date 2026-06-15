/**
 * @file Chattvy där användaren skriver till Leffe via konfigurerad LLM.
 */

import { send_llm_chat_stream } from '../api/client.js';
import {
    create_assistant_message,
    create_user_message,
    is_chat_input_valid,
    render_chat_bubble_element,
    trim_chat_input,
    type ChatMessage
} from './ai_chat_helpers.ts';
import { create_streaming_assistant_bubble, type StreamingAssistantBubble } from './ai_chat_stream_ui.ts';
import { resolve_tool_activity_label } from './ai_chat_tool_labels.ts';
import {
    play_ai_chat_reply_chime,
    unlock_ai_chat_reply_audio
} from '../utils/ai_chat_reply_chime.ts';
import {
    list_ai_chat_sessions,
    resolve_current_user_id_for_storage
} from '../logic/ai_chat_history.ts';
import {
    begin_chat_session,
    clear_empty_chat_session,
    load_chat_from_route_params,
    persist_chat_session
} from '../logic/ai_chat_view_history.ts';
import { AiChatHistorySidebarComponent } from './AiChatHistorySidebarComponent.ts';
import './ai_chat_view_component.css';

export class AiChatViewComponent {
    CSS_PATH = './ai_chat_view_component.css';
    root: HTMLElement | null = null;
    deps: any = null;
    Helpers: any = null;
    Translation: any = null;
    messages: ChatMessage[] = [];
    _send_in_progress = false;
    _error_message: string | null = null;
    message_input_ref: HTMLTextAreaElement | null = null;
    thread_ref: HTMLElement | null = null;
    _streaming_bubble: StreamingAssistantBubble | null = null;
    _abort_controller: AbortController | null = null;
    _compose_value = '';
    _active_chat_id: string | null = null;
    _chat_title: string | null = null;
    _user_storage_id: string | null = null;
    _right_sidebar_root: HTMLElement | null = null;
    _history_sidebar: AiChatHistorySidebarComponent | null = null;
    _router: ((view: string, params?: Record<string, string>, opts?: { replace_state?: boolean }) => void) | null = null;

    async init({ root, deps }: { root: HTMLElement; deps: any }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this._router = deps.router || null;
        this._right_sidebar_root = deps.rightSidebarRoot || null;
        this._handle_submit = this._handle_submit.bind(this);
        this._handle_input = this._handle_input.bind(this);

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }

        this._user_storage_id = await resolve_current_user_id_for_storage();
        const loaded = load_chat_from_route_params(this._user_storage_id, deps.params || {});
        this._active_chat_id = loaded.chat_id;
        this._chat_title = loaded.title;
        this.messages = loaded.messages;

        if (this._right_sidebar_root) {
            this._history_sidebar = new AiChatHistorySidebarComponent();
            await this._history_sidebar.init({
                root: this._right_sidebar_root,
                deps: {
                    router: this._router || (() => {}),
                    Translation: this.Translation,
                    Helpers: this.Helpers
                }
            });
            this._render_history_sidebar();
        }
    }

    _render_history_sidebar() {
        if (!this._history_sidebar || !this._user_storage_id) return;
        this._history_sidebar.render({
            sessions: list_ai_chat_sessions(this._user_storage_id),
            active_chat_id: this._active_chat_id
        });
    }

    _persist_active_chat() {
        persist_chat_session(
            this._user_storage_id,
            this._active_chat_id,
            this._chat_title,
            this.messages,
            this._t('ai_chat_history_untitled')
        );
        this._render_history_sidebar();
    }

    _begin_chat_session(first_question: string) {
        if (this._active_chat_id) return;
        const started = begin_chat_session(first_question, this._t('ai_chat_history_untitled'));
        this._active_chat_id = started.chat_id;
        this._chat_title = started.title;
        if (this._router) {
            this._router('ai_chat', { chatId: this._active_chat_id }, { replace_state: true });
        }
    }

    _t(key: string): string {
        return this.Translation?.t?.(key) ?? key;
    }

    _build_chat_context() {
        const state = this.deps?.getState?.() || {};
        const audit_id = typeof state.auditId === 'string' ? state.auditId : null;
        const rule_set_id = typeof state.ruleSetId === 'string' ? state.ruleSetId : null;
        return { audit_id, rule_set_id };
    }

    _clear_error() {
        this._error_message = null;
    }

    _set_error(message: string) {
        this._error_message = message;
    }

    _scroll_thread_to_bottom() {
        if (!this.thread_ref) return;
        this.thread_ref.scrollTop = this.thread_ref.scrollHeight;
    }

    _render_thread(thread: HTMLElement) {
        thread.innerHTML = '';
        const user_label = this._t('ai_chat_message_user_label');
        const assistant_label = this._t('ai_chat_message_assistant_label');
        this.messages.forEach((message) => {
            thread.appendChild(
                render_chat_bubble_element({
                    Helpers: this.Helpers,
                    message,
                    user_label,
                    assistant_label
                })
            );
        });
        if (this._send_in_progress) {
            const stream_ui = create_streaming_assistant_bubble(
                this.Helpers,
                assistant_label,
                this._t('ai_chat_waiting_model')
            );
            this._streaming_bubble = stream_ui;
            thread.appendChild(stream_ui.bubble);
        } else {
            this._streaming_bubble = null;
        }
    }

    _update_streaming_delta(delta: {
        content: string;
        thinking: string;
        tool_activity: string | null;
    }) {
        const stream_ui = this._streaming_bubble;
        if (!stream_ui) return;
        if (delta.tool_activity !== undefined) {
            stream_ui.set_tool_activity(resolve_tool_activity_label(delta.tool_activity, (k) => this._t(k)));
        }
        if (delta.thinking !== undefined) {
            stream_ui.set_thinking(this._t('ai_chat_thinking_label'), delta.thinking);
        }
        if (delta.content !== undefined) {
            stream_ui.set_content(delta.content);
        }
        this._scroll_thread_to_bottom();
    }

    _append_compose_form(panel: HTMLElement) {
        const form = this.Helpers.create_element('form', {
            class_name: 'ai-chat-compose',
            attributes: { id: 'ai-chat-compose-form' }
        });
        form.addEventListener('submit', this._handle_submit);

        const field_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        const label = this.Helpers.create_element('label', {
            attributes: { for: 'ai-chat-message-input' },
            class_name: 'form-field-label',
            text_content: this._t('ai_chat_message_label')
        });
        const help = this.Helpers.create_element('p', {
            class_name: 'form-help',
            attributes: { id: 'ai-chat-message-help' },
            text_content: this._t('ai_chat_message_help')
        });
        this.message_input_ref = this.Helpers.create_element('textarea', {
            attributes: {
                id: 'ai-chat-message-input',
                rows: '4',
                'aria-describedby': 'ai-chat-message-help'
            },
            class_name: ['form-control', 'ai-chat-message-input']
        }) as HTMLTextAreaElement;
        this.message_input_ref.addEventListener('input', this._handle_input);
        this.message_input_ref.addEventListener('focus', unlock_ai_chat_reply_audio);
        if (this._compose_value) {
            this.message_input_ref.value = this._compose_value;
        }

        field_group.appendChild(label);
        field_group.appendChild(help);
        field_group.appendChild(this.message_input_ref);
        form.appendChild(field_group);

        if (!this._send_in_progress) {
            const actions = this.Helpers.create_element('div', { class_name: 'ai-chat-compose__actions' });
            actions.appendChild(this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: this._t('ai_chat_send'),
                attributes: { type: 'submit' }
            }));
            form.appendChild(actions);
        }

        if (this._error_message) {
            form.appendChild(this.Helpers.create_element('p', {
                class_name: 'ai-chat-error',
                text_content: this._error_message,
                attributes: {
                    id: 'ai-chat-error',
                    'aria-live': 'assertive',
                    'aria-atomic': 'true'
                }
            }));
            if (this.message_input_ref) {
                this.message_input_ref.setAttribute('aria-describedby', 'ai-chat-message-help ai-chat-error');
            }
        }

        panel.appendChild(form);
    }

    async _handle_submit(event: Event) {
        event.preventDefault();
        if (this._send_in_progress || !this.message_input_ref) return;

        const text = trim_chat_input(this.message_input_ref.value);
        if (!is_chat_input_valid(text)) {
            this._set_error(this._t('ai_chat_empty_message'));
            this.render();
            return;
        }

        this.message_input_ref.value = '';
        this._compose_value = '';

        this._clear_error();
        this._begin_chat_session(text);
        const next_messages = [...this.messages, create_user_message(text)];
        this.messages = next_messages;
        this._persist_active_chat();
        this._send_in_progress = true;
        this._abort_controller = new AbortController();
        unlock_ai_chat_reply_audio();
        this.render();

        try {
            const result = await send_llm_chat_stream(next_messages, {
                signal: this._abort_controller.signal,
                context: this._build_chat_context(),
                on_delta: (delta) => this._update_streaming_delta(delta)
            });
            const reply = typeof result?.content === 'string' ? result.content.trim() : '';
            if (!reply) {
                throw new Error(this._t('ai_chat_error'));
            }
            this.messages = [...next_messages, create_assistant_message(reply)];
            this._send_in_progress = false;
            this._abort_controller = null;
            this._persist_active_chat();
            this.render();
            play_ai_chat_reply_chime();
            requestAnimationFrame(() => {
                this.message_input_ref?.focus({ preventScroll: true });
            });
        } catch (err) {
            this.messages = next_messages.slice(0, -1);
            if (!this.messages.length && this._active_chat_id) {
                clear_empty_chat_session(this._user_storage_id, this._active_chat_id);
                this._active_chat_id = null;
                this._chat_title = null;
                if (this._router) {
                    this._router('ai_chat', {}, { replace_state: true });
                }
                this._render_history_sidebar();
            }
            this._send_in_progress = false;
            this._abort_controller = null;
            this._set_error((err instanceof Error ? err.message : null) || this._t('ai_chat_error'));
            this.render();
            requestAnimationFrame(() => {
                if (!this.message_input_ref) return;
                this._compose_value = text;
                this.message_input_ref.value = text;
                this.message_input_ref.focus({ preventScroll: true });
            });
        }
    }

    _handle_input() {
        if (this.message_input_ref) {
            this._compose_value = this.message_input_ref.value;
        }
        if (this._error_message) {
            this._clear_error();
            this._update_error_visibility();
        }
    }

    _update_error_visibility() {
        const error_el = this.root?.querySelector('#ai-chat-error');
        if (error_el) error_el.remove();
        if (this.message_input_ref) {
            this.message_input_ref.setAttribute('aria-describedby', 'ai-chat-message-help');
        }
    }

    render() {
        if (!this.root || !this.Helpers) return;
        this.root.innerHTML = '';

        const plate = this.Helpers.create_element('div', {
            class_name: ['view-container', 'plate', 'ai-chat-plate']
        });
        plate.appendChild(
            this.Helpers.create_element('h1', {
                attributes: { id: 'ai-chat-view-title' },
                text_content: this._t('ai_chat_view_title')
            })
        );
        plate.appendChild(
            this.Helpers.create_element('p', {
                class_name: 'ai-chat-intro',
                text_content: this._t('ai_chat_view_intro')
            })
        );

        const panel = this.Helpers.create_element('div', { class_name: 'ai-chat-panel' });
        this.thread_ref = this.Helpers.create_element('div', {
            class_name: 'ai-chat-thread'
        });
        this._render_thread(this.thread_ref);
        panel.appendChild(this.thread_ref);
        this._append_compose_form(panel);
        plate.appendChild(panel);
        this.root.appendChild(plate);

        requestAnimationFrame(() => this._scroll_thread_to_bottom());
        this._render_history_sidebar();
    }

    destroy() {
        this._abort_controller?.abort();
        this._abort_controller = null;
        this._persist_active_chat();
        this._history_sidebar?.destroy();
        this._history_sidebar = null;
        if (this._right_sidebar_root) {
            this._right_sidebar_root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.messages = [];
        this.message_input_ref = null;
        this.thread_ref = null;
        this._streaming_bubble = null;
        this._compose_value = '';
        this._active_chat_id = null;
        this._chat_title = null;
        this._user_storage_id = null;
        this._right_sidebar_root = null;
        this._router = null;
    }
}
