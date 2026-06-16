/**
 * @file Hjälpfunktioner för AI-chattvyn (meddelanden och DOM).
 */

import {
    apply_safe_markdown_to_element,
    render_safe_markdown_html,
    type SafeMarkdownHelpers
} from '../utils/render_safe_markdown.ts';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export function create_user_message(content: string): ChatMessage {
    return { role: 'user', content: content.trim() };
}

export function create_assistant_message(content: string): ChatMessage {
    return { role: 'assistant', content: content.trim() };
}

export function trim_chat_input(value: string): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function is_chat_input_valid(value: string): boolean {
    return trim_chat_input(value).length > 0;
}

interface RenderChatBubbleOptions {
    Helpers: {
        create_element: (
            tag: string,
            options?: {
                class_name?: string | string[];
                text_content?: string;
                html_content?: string;
                attributes?: Record<string, string>;
            }
        ) => HTMLElement;
        escape_html?: (value: string) => string;
        sanitize_html?: (value: string) => string;
    };
    message: ChatMessage;
    user_label: string;
    assistant_label: string;
}

function resolve_markdown_helpers(Helpers: RenderChatBubbleOptions['Helpers']): SafeMarkdownHelpers {
    return {
        escape_html: Helpers.escape_html,
        sanitize_html: Helpers.sanitize_html
    };
}

export function render_chat_bubble_element(options: RenderChatBubbleOptions): HTMLElement {
    const { Helpers, message, user_label, assistant_label } = options;
    const markdown_helpers = resolve_markdown_helpers(Helpers);
    const is_user = message.role === 'user';
    const bubble = Helpers.create_element('article', {
        class_name: ['ai-chat-bubble', is_user ? 'ai-chat-bubble--user' : 'ai-chat-bubble--assistant']
    });
    bubble.appendChild(Helpers.create_element('p', {
        class_name: 'ai-chat-bubble__sender',
        text_content: is_user ? user_label : assistant_label
    }));
    const body_attributes: Record<string, string> = {};
    if (!is_user) {
        body_attributes['aria-live'] = 'polite';
        body_attributes.role = 'status';
    }
    bubble.appendChild(
        Helpers.create_element('div', {
            class_name: ['ai-chat-bubble__body', 'markdown-content'],
            html_content: render_safe_markdown_html(message.content, markdown_helpers),
            attributes: body_attributes
        })
    );
    return bubble;
}

export function apply_chat_thinking_to_element(
    element: HTMLElement,
    label: string,
    text: string,
    helpers: SafeMarkdownHelpers = {}
): void {
    element.innerHTML = '';
    const raw = String(text ?? '');
    if (!raw.trim()) {
        element.setAttribute('hidden', 'hidden');
        return;
    }
    element.removeAttribute('hidden');
    if (label) {
        const label_el = document.createElement('span');
        label_el.className = 'ai-chat-bubble__thinking-label';
        label_el.textContent = label;
        element.appendChild(label_el);
    }
    const text_el = document.createElement('div');
    text_el.className = 'ai-chat-bubble__thinking-text markdown-content';
    apply_safe_markdown_to_element(text_el, raw, helpers);
    element.appendChild(text_el);
}
