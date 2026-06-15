import { describe, test, expect } from '@jest/globals';
import { validate_chat_messages } from '../../server/services/llm_chat_validation.ts';

describe('llm_chat_validation', () => {
    test('validate_chat_messages accepterar giltiga meddelanden', () => {
        const messages = validate_chat_messages([
            { role: 'user', content: 'Hej' },
            { role: 'assistant', content: 'Hej där!' }
        ]);
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('user');
    });

    test('validate_chat_messages avvisar tom lista', () => {
        expect(() => validate_chat_messages([])).toThrow(/tom/);
    });

    test('validate_chat_messages avvisar tom text', () => {
        expect(() => validate_chat_messages([{ role: 'user', content: '   ' }])).toThrow(/saknas/);
    });
});
