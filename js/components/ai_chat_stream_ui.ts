/**
 * @file DOM-hjälp för pågående strömmande svar i chattvyn.
 */

interface StreamBubbleHelpers {
    create_element: (
        tag: string,
        options?: {
            class_name?: string | string[];
            text_content?: string;
            attributes?: Record<string, string>;
        }
    ) => HTMLElement;
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

export function create_streaming_assistant_bubble(
    Helpers: StreamBubbleHelpers,
    assistant_label: string,
    waiting_text: string
): StreamingAssistantBubble {
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
    const thinking_el = Helpers.create_element('p', {
        class_name: 'ai-chat-bubble__thinking',
        attributes: { hidden: 'hidden' }
    });
    const body_el = Helpers.create_element('p', {
        class_name: 'ai-chat-bubble__body',
        text_content: waiting_text,
        attributes: {
            'aria-live': 'polite',
            role: 'status'
        }
    });
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
            thinking_el.textContent = '';
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
            if (!text) {
                thinking_el.setAttribute('hidden', 'hidden');
                thinking_el.textContent = '';
                return;
            }
            thinking_el.removeAttribute('hidden');
            thinking_el.textContent = `${label}\n${text}`;
        },
        set_content(text: string) {
            body_el.textContent = text;
        }
    };
}
