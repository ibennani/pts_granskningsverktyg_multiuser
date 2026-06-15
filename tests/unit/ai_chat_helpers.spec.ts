import { describe, test, expect } from '@jest/globals';
import {
    create_user_message,
    is_chat_input_valid,
    render_chat_bubble_element,
    trim_chat_input
} from '../../js/components/ai_chat_helpers.ts';
import { create_streaming_assistant_bubble } from '../../js/components/ai_chat_stream_ui.ts';

describe('ai_chat_helpers', () => {
    test('trim_chat_input tar bort mellanslag', () => {
        expect(trim_chat_input('  hej  ')).toBe('hej');
    });

    test('is_chat_input_valid kräver innehåll', () => {
        expect(is_chat_input_valid('')).toBe(false);
        expect(is_chat_input_valid('Hej')).toBe(true);
    });

    test('create_user_message trimmar text', () => {
        expect(create_user_message('  Hej  ')).toEqual({ role: 'user', content: 'Hej' });
    });

    test('render_chat_bubble_element sätter aria-live endast på Leffes svarstext', () => {
        const Helpers = {
            create_element: (tag, options = {}) => {
                const el = document.createElement(tag);
                const class_name = options.class_name;
                if (class_name) {
                    const names = Array.isArray(class_name) ? class_name : [class_name];
                    el.className = names.join(' ');
                }
                if (options.text_content) el.textContent = options.text_content;
                if (options.attributes) {
                    Object.entries(options.attributes).forEach(([key, value]) => {
                        el.setAttribute(key, value);
                    });
                }
                return el;
            }
        };

        const assistant_bubble = render_chat_bubble_element({
            Helpers,
            message: { role: 'assistant', content: 'Hej där' },
            user_label: 'Du',
            assistant_label: 'Leffe'
        });
        const assistant_body = assistant_bubble.querySelector('.ai-chat-bubble__body');
        expect(assistant_body?.getAttribute('aria-live')).toBe('polite');
        expect(assistant_body?.getAttribute('role')).toBe('status');
        expect(assistant_bubble.querySelector('.ai-chat-bubble__thinking')).toBeNull();

        const user_bubble = render_chat_bubble_element({
            Helpers,
            message: { role: 'user', content: 'Min fråga' },
            user_label: 'Du',
            assistant_label: 'Leffe'
        });
        const user_body = user_bubble.querySelector('.ai-chat-bubble__body');
        expect(user_body?.getAttribute('aria-live')).toBeNull();
    });
});
