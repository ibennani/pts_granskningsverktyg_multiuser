/**
 * @file Koppling mellan chattvy och sparad chatthistorik.
 */

import type { ChatMessage } from '../components/ai_chat_helpers.ts';
import {
    create_chat_session_id,
    derive_chat_title,
    get_ai_chat_session,
    remove_ai_chat_session,
    upsert_ai_chat_session,
    type AiChatSession
} from './ai_chat_history.ts';

export function load_chat_from_route_params(
    user_id: string | null,
    params: Record<string, unknown>
): { chat_id: string | null; title: string | null; messages: ChatMessage[] } {
    const chat_id = typeof params.chatId === 'string' ? params.chatId : null;
    if (!chat_id || !user_id) {
        return { chat_id: null, title: null, messages: [] };
    }
    const session = get_ai_chat_session(user_id, chat_id);
    if (!session) {
        return { chat_id: null, title: null, messages: [] };
    }
    return {
        chat_id: session.id,
        title: session.title,
        messages: session.messages.map((m) => ({ ...m }))
    };
}

export function begin_chat_session(
    first_question: string,
    untitled_label: string
): { chat_id: string; title: string } {
    return {
        chat_id: create_chat_session_id(),
        title: derive_chat_title(first_question, untitled_label)
    };
}

export function persist_chat_session(
    user_id: string | null,
    chat_id: string | null,
    title: string | null,
    messages: ChatMessage[],
    untitled_label: string
): void {
    if (!user_id || !chat_id || !messages.length) return;
    const now = Date.now();
    const session: AiChatSession = {
        id: chat_id,
        title: title || derive_chat_title(
            messages.find((m) => m.role === 'user')?.content || '',
            untitled_label
        ),
        messages: messages.map((m) => ({ ...m })),
        created_at: now,
        updated_at: now
    };
    const existing = get_ai_chat_session(user_id, chat_id);
    if (existing) session.created_at = existing.created_at;
    upsert_ai_chat_session(user_id, session);
}

export function clear_empty_chat_session(user_id: string | null, chat_id: string | null): void {
    if (!user_id || !chat_id) return;
    remove_ai_chat_session(user_id, chat_id);
}
