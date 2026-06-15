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

interface RenderChatMessageOptions {
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

export function render_chat_message_element(options: RenderChatMessageOptions): HTMLElement {
    const { Helpers, message, user_label, assistant_label } = options;
    const is_user = message.role === 'user';
    const article = Helpers.create_element('article', {
        class_name: ['ai-chat-message', is_user ? 'ai-chat-message--user' : 'ai-chat-message--assistant']
    });
    const heading = Helpers.create_element('h2', {
        class_name: 'ai-chat-message__heading',
        text_content: is_user ? user_label : assistant_label
    });
    const body = Helpers.create_element('p', {
        class_name: 'ai-chat-message__body',
        text_content: message.content
    });
    article.appendChild(heading);
    article.appendChild(body);
    return article;
}
