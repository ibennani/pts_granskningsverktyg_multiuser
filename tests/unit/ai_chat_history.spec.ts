/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    derive_chat_title,
    upsert_ai_chat_session,
    list_ai_chat_sessions,
    get_ai_chat_session
} from '../../js/logic/ai_chat_history.ts';

describe('ai_chat_history', () => {
    const storage = new Map<string, string>();

    beforeEach(() => {
        storage.clear();
        global.localStorage = {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => {
                storage.set(key, value);
            },
            removeItem: (key) => {
                storage.delete(key);
            },
            clear: () => storage.clear(),
            key: () => null,
            length: 0
        } as Storage;
    });

    test('derive_chat_title använder första frågan', () => {
        expect(derive_chat_title('  Hur många granskningar?  ', 'Namnlös')).toBe('Hur många granskningar?');
    });

    test('upsert_ai_chat_session sparar och läser tillbaka chatt', () => {
        const user_id = 'user-1';
        const session = {
            id: 'chat-1',
            title: 'Första frågan',
            messages: [{ role: 'user', content: 'Hej' }],
            created_at: 1000,
            updated_at: 1000
        };
        upsert_ai_chat_session(user_id, session);
        expect(get_ai_chat_session(user_id, 'chat-1')?.title).toBe('Första frågan');
        expect(list_ai_chat_sessions(user_id)).toHaveLength(1);
    });

    test('upsert_ai_chat_session behåller högst 20 chattar', () => {
        const user_id = 'user-2';
        for (let i = 0; i < 25; i += 1) {
            upsert_ai_chat_session(user_id, {
                id: `chat-${i}`,
                title: `Chatt ${i}`,
                messages: [{ role: 'user', content: `Fråga ${i}` }],
                created_at: i,
                updated_at: i
            });
        }
        const sessions = list_ai_chat_sessions(user_id);
        expect(sessions).toHaveLength(20);
        expect(sessions[0]?.id).toBe('chat-24');
    });
});
