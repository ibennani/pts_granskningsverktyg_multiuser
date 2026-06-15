/**
 * @file Hjälpfunktioner för AI-chattvyn (meddelanden och DOM).
 */

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
                attributes?: Record<string, string>;
            }
        ) => HTMLElement;
    };
    message: ChatMessage;
    user_label: string;
    assistant_label: string;
}

export function render_chat_bubble_element(options: RenderChatBubbleOptions): HTMLElement {
    const { Helpers, message, user_label, assistant_label } = options;
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
    bubble.appendChild(Helpers.create_element('p', {
        class_name: 'ai-chat-bubble__body',
        text_content: message.content,
        attributes: body_attributes
    }));
    return bubble;
}
