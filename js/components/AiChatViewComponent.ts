/**
 * @file Chattvy där användaren skriver till Leffe via konfigurerad LLM.
 */

import { send_llm_chat } from '../api/client.js';
import {
    create_assistant_message,
    create_user_message,
    is_chat_input_valid,
    render_chat_message_element,
    trim_chat_input,
    type ChatMessage
} from './ai_chat_helpers.ts';
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
    log_ref: HTMLElement | null = null;
    status_ref: HTMLElement | null = null;

    async init({ root, deps }: { root: HTMLElement; deps: any }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this._handle_submit = this._handle_submit.bind(this);
        this._handle_input = this._handle_input.bind(this);

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    }

    _t(key: string): string {
        return this.Translation?.t?.(key) ?? key;
    }

    _clear_error() {
        this._error_message = null;
    }

    _set_error(message: string) {
        this._error_message = message;
    }

    _render_messages(log: HTMLElement) {
        log.innerHTML = '';
        const user_label = this._t('ai_chat_message_user_label');
        const assistant_label = this._t('ai_chat_message_assistant_label');
        this.messages.forEach((message) => {
            log.appendChild(
                render_chat_message_element({
                    Helpers: this.Helpers,
                    message,
                    user_label,
                    assistant_label
                })
            );
        });
    }

    _append_compose_form(plate: HTMLElement) {
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

        field_group.appendChild(label);
        field_group.appendChild(help);
        field_group.appendChild(this.message_input_ref);
        form.appendChild(field_group);

        const actions = this.Helpers.create_element('div', { class_name: 'ai-chat-compose__actions' });
        if (this._send_in_progress) {
            this.status_ref = this.Helpers.create_element('p', {
                class_name: 'ai-chat-status',
                text_content: this._t('ai_chat_sending'),
                attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' }
            });
            actions.appendChild(this.status_ref);
        } else {
            const send_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: this._t('ai_chat_send'),
                attributes: { type: 'submit' }
            });
            actions.appendChild(send_btn);
        }
        form.appendChild(actions);

        if (this._error_message) {
            const error_el = this.Helpers.create_element('p', {
                class_name: 'ai-chat-error',
                text_content: this._error_message,
                attributes: {
                    id: 'ai-chat-error',
                    'aria-live': 'assertive',
                    'aria-atomic': 'true'
                }
            });
            form.appendChild(error_el);
            if (this.message_input_ref) {
                this.message_input_ref.setAttribute('aria-describedby', 'ai-chat-message-help ai-chat-error');
            }
        }

        plate.appendChild(form);
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

        this._clear_error();
        const next_messages = [...this.messages, create_user_message(text)];
        this.messages = next_messages;
        this._send_in_progress = true;
        this.message_input_ref.value = '';
        this.render();

        try {
            const result = await send_llm_chat(next_messages);
            const reply = typeof result?.content === 'string' ? result.content.trim() : '';
            if (!reply) {
                throw new Error(this._t('ai_chat_error'));
            }
            this.messages = [...next_messages, create_assistant_message(reply)];
            this._send_in_progress = false;
            this.render();
            requestAnimationFrame(() => {
                this.message_input_ref?.focus({ preventScroll: true });
            });
        } catch (err) {
            this.messages = next_messages.slice(0, -1);
            this._send_in_progress = false;
            this._set_error((err instanceof Error ? err.message : null) || this._t('ai_chat_error'));
            this.render();
            requestAnimationFrame(() => {
                if (!this.message_input_ref) return;
                this.message_input_ref.value = text;
                this.message_input_ref.focus({ preventScroll: true });
            });
        }
    }

    _handle_input() {
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

        this.log_ref = this.Helpers.create_element('div', {
            class_name: 'ai-chat-log',
            attributes: { 'aria-live': 'polite', 'aria-relevant': 'additions' }
        });
        this._render_messages(this.log_ref);
        plate.appendChild(this.log_ref);

        this._append_compose_form(plate);
        this.root.appendChild(plate);

        if (this.log_ref && this.messages.length > 0) {
            this.log_ref.scrollTop = this.log_ref.scrollHeight;
        }
    }

    destroy() {
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.messages = [];
        this.message_input_ref = null;
        this.log_ref = null;
        this.status_ref = null;
    }
}
