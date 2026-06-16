/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { resolve_chat_reply_text } from '../../shared/llm/resolve_chat_reply_text.ts';

describe('resolve_chat_reply_text', () => {
    test('föredrar content framför thinking', () => {
        expect(resolve_chat_reply_text('Hej', 'Tänker')).toBe('Hej');
    });

    test('använder thinking när content saknas', () => {
        expect(resolve_chat_reply_text('', 'Det finns 3 granskningar.')).toBe('Det finns 3 granskningar.');
    });
});
