/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { is_inadequate_chat_reply } from '../../shared/llm/is_inadequate_chat_reply.ts';

describe('is_inadequate_chat_reply', () => {
    test('markerar korta stub-svar', () => {
        expect(is_inadequate_chat_reply('Here')).toBe(true);
        expect(is_inadequate_chat_reply('ok')).toBe(true);
    });

    test('accepterar tydligt svar', () => {
        expect(
            is_inadequate_chat_reply(
                'Den första granskningen är "Webbplats X" som skapades 2024-03-12.'
            )
        ).toBe(false);
    });
});
