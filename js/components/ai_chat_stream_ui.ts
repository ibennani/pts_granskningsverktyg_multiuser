/**
 * @file DOM-hjälp för pågående strömmande svar i chattvyn.
 */

import { apply_chat_thinking_to_element } from './ai_chat_helpers.ts';
import {
    apply_safe_markdown_to_element,
    type SafeMarkdownHelpers
} from '../utils/render_safe_markdown.ts';

interface StreamBubbleHelpers {
    create_element: (
        tag: string,
        options?: {
            class_name?: string | string[];
            text_content?: string;
            attributes?: Record<string, string>;
        }
    ) => HTMLElement;
    escape_html?: (value: string) => string;
    sanitize_html?: (value: string) => string;
}

export interface StreamingAssistantBubble {
    bubble: HTMLElement;
    thinking_el: HTMLElement;
    tool_el: HTMLElement;
    body_el: HTMLElement;
    set_waiting: (text: string) => void;
    set_thinking: (label: string, text: string) => void;
    set_tool_activity: (text: string | null) => void;
    set_content: (text: string) => void;
}

function resolve_markdown_helpers(Helpers: StreamBubbleHelpers): SafeMarkdownHelpers {
    return {
        escape_html: Helpers.escape_html,
        sanitize_html: Helpers.sanitize_html
    };
}

export function create_streaming_assistant_bubble(
    Helpers: StreamBubbleHelpers,
    assistant_label: string,
    waiting_text: string
): StreamingAssistantBubble {
    const markdown_helpers = resolve_markdown_helpers(Helpers);
    const bubble = Helpers.create_element('article', {
        class_name: [
            'ai-chat-bubble',
            'ai-chat-bubble--assistant',
            'ai-chat-bubble--pending',
            'ai-chat-bubble--streaming'
        ]
    });
    bubble.appendChild(
        Helpers.create_element('p', {
            class_name: 'ai-chat-bubble__sender',
            text_content: assistant_label
        })
    );
    const tool_el = Helpers.create_element('p', {
        class_name: 'ai-chat-bubble__tool-activity',
        attributes: { hidden: 'hidden' }
    });
    const thinking_el = Helpers.create_element('div', {
        class_name: 'ai-chat-bubble__thinking',
        attributes: { hidden: 'hidden' }
    });
    const body_el = Helpers.create_element('div', {
        class_name: ['ai-chat-bubble__body', 'markdown-content'],
        attributes: {
            'aria-live': 'polite',
            role: 'status'
        }
    });
    body_el.textContent = waiting_text;
    bubble.appendChild(tool_el);
    bubble.appendChild(thinking_el);
    bubble.appendChild(body_el);

    return {
        bubble,
        thinking_el,
        tool_el,
        body_el,
        set_waiting(text: string) {
            tool_el.setAttribute('hidden', 'hidden');
            tool_el.textContent = '';
            thinking_el.setAttribute('hidden', 'hidden');
            thinking_el.innerHTML = '';
            body_el.textContent = text;
        },
        set_tool_activity(text: string | null) {
            if (!text) {
                tool_el.setAttribute('hidden', 'hidden');
                tool_el.textContent = '';
                return;
            }
            tool_el.removeAttribute('hidden');
            tool_el.textContent = text;
        },
        set_thinking(label: string, text: string) {
            apply_chat_thinking_to_element(thinking_el, label, text, markdown_helpers);
        },
        set_content(text: string) {
            apply_safe_markdown_to_element(body_el, text, markdown_helpers);
        }
    };
}
