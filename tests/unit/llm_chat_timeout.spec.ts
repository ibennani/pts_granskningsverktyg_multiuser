import { describe, test, expect } from '@jest/globals';
import {
    resolve_chat_timeout_ms,
    format_llm_chat_error,
    LLM_CHAT_TIMEOUT_MIN_MS
} from '../../server/services/llm_chat_timeout.ts';

describe('llm_chat_timeout', () => {
    test('resolve_chat_timeout_ms höjer kort timeout till minimum för chatt', () => {
        expect(resolve_chat_timeout_ms(60_000)).toBe(LLM_CHAT_TIMEOUT_MIN_MS);
    });

    test('resolve_chat_timeout_ms behåller högre värde inom max', () => {
        expect(resolve_chat_timeout_ms(450_000)).toBe(450_000);
    });

    test('format_llm_chat_error översätter timeout till tydligt fel', () => {
        expect(format_llm_chat_error(new Error('The operation was aborted due to timeout'))).toMatch(
            /tidsgränsen/
        );
    });
});
