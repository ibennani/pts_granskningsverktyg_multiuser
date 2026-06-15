import { describe, test, expect } from '@jest/globals';
import {
    create_user_message,
    is_chat_input_valid,
    trim_chat_input
} from '../../js/components/ai_chat_helpers.ts';

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
});
