/**
 * @file Sparar och läser tidigare AI-chattar per inloggad användare (localStorage, max 20).
 */

import type { ChatMessage } from '../components/ai_chat_helpers.ts';
import { trim_chat_input } from '../components/ai_chat_helpers.ts';
import { get_current_user_name } from '../user/current_user.js';

const STORAGE_VERSION = 1;
const MAX_CHAT_SESSIONS = 20;
const TITLE_MAX_LENGTH = 72;

export interface AiChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    created_at: number;
    updated_at: number;
}

interface AiChatHistoryFile {
    schema_version: number;
    sessions: AiChatSession[];
}

function storage_key_for_user(user_id: string): string {
    return `leffe_ai_chat_history_v${STORAGE_VERSION}:${user_id}`;
}

function safe_parse_history(raw: string | null): AiChatHistoryFile | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as AiChatHistoryFile;
        if (!parsed || parsed.schema_version !== STORAGE_VERSION || !Array.isArray(parsed.sessions)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function normalize_session(raw: unknown): AiChatSession | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Partial<AiChatSession>;
    if (typeof row.id !== 'string' || !row.id.trim()) return null;
    if (typeof row.title !== 'string' || !row.title.trim()) return null;
    if (!Array.isArray(row.messages)) return null;
    const messages = row.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.trim() }))
        .filter((m) => m.content.length > 0) as ChatMessage[];
    if (!messages.length) return null;
    const created_at = Number.isFinite(Number(row.created_at)) ? Number(row.created_at) : Date.now();
    const updated_at = Number.isFinite(Number(row.updated_at)) ? Number(row.updated_at) : created_at;
    return {
        id: row.id.trim(),
        title: row.title.trim(),
        messages,
        created_at,
        updated_at
    };
}

function read_history_file(user_id: string): AiChatHistoryFile {
    if (typeof localStorage === 'undefined' || !user_id) {
        return { schema_version: STORAGE_VERSION, sessions: [] };
    }
    const parsed = safe_parse_history(localStorage.getItem(storage_key_for_user(user_id)));
    if (!parsed) return { schema_version: STORAGE_VERSION, sessions: [] };
    const sessions = parsed.sessions
        .map(normalize_session)
        .filter((s): s is AiChatSession => s !== null)
        .sort((a, b) => b.updated_at - a.updated_at)
        .slice(0, MAX_CHAT_SESSIONS);
    return { schema_version: STORAGE_VERSION, sessions };
}

function write_history_file(user_id: string, sessions: AiChatSession[]): void {
    if (typeof localStorage === 'undefined' || !user_id) return;
    const payload: AiChatHistoryFile = {
        schema_version: STORAGE_VERSION,
        sessions: sessions.slice(0, MAX_CHAT_SESSIONS)
    };
    localStorage.setItem(storage_key_for_user(user_id), JSON.stringify(payload));
}

export function create_chat_session_id(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function derive_chat_title(first_question: string, fallback_title: string): string {
    const trimmed = trim_chat_input(first_question).replace(/\s+/g, ' ');
    if (!trimmed) return fallback_title;
    if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;
    return `${trimmed.slice(0, TITLE_MAX_LENGTH - 1)}…`;
}

export async function resolve_current_user_id_for_storage(): Promise<string | null> {
    try {
        const { get_current_user_preferences } = await import('../api/client.js');
        const user = await get_current_user_preferences();
        if (user?.id) return String(user.id);
    } catch {
        // Fortsätt med namn som reservnyckel.
    }
    const name = get_current_user_name();
    if (name) return `name:${name}`;
    return null;
}

export function list_ai_chat_sessions(user_id: string | null): AiChatSession[] {
    if (!user_id) return [];
    return read_history_file(user_id).sessions;
}

export function get_ai_chat_session(user_id: string | null, chat_id: string | null): AiChatSession | null {
    if (!user_id || !chat_id) return null;
    return read_history_file(user_id).sessions.find((s) => s.id === chat_id) || null;
}

export function upsert_ai_chat_session(
    user_id: string | null,
    session: AiChatSession
): AiChatSession[] {
    if (!user_id || !session.id || !session.messages.length) return list_ai_chat_sessions(user_id);
    const normalized = normalize_session(session);
    if (!normalized) return list_ai_chat_sessions(user_id);
    const others = read_history_file(user_id).sessions.filter((s) => s.id !== normalized.id);
    const merged = [normalized, ...others]
        .sort((a, b) => b.updated_at - a.updated_at)
        .slice(0, MAX_CHAT_SESSIONS);
    write_history_file(user_id, merged);
    return merged;
}

export function remove_ai_chat_session(user_id: string | null, chat_id: string | null): AiChatSession[] {
    if (!user_id || !chat_id) return list_ai_chat_sessions(user_id);
    const merged = read_history_file(user_id).sessions.filter((s) => s.id !== chat_id);
    write_history_file(user_id, merged);
    return merged;
}
