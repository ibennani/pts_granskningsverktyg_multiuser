/**
 * @file Validering av inkommande chattmeddelanden till LLM-proxy.
 */

export interface ChatMessageInput {
    role: 'user' | 'assistant';
    content: string;
}

export function validate_chat_messages(raw: unknown): ChatMessageInput[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error('Meddelandelistan får inte vara tom.');
    }
    if (raw.length > 50) {
        throw new Error('För många meddelanden i en begäran.');
    }
    return raw.map((item, index) => validate_single_message(item, index + 1));
}

function validate_single_message(item: unknown, position: number): ChatMessageInput {
    if (!item || typeof item !== 'object') {
        throw new Error(`Ogiltigt meddelande på position ${position}.`);
    }
    const record = item as { role?: unknown; content?: unknown };
    if (record.role !== 'user' && record.role !== 'assistant') {
        throw new Error(`Ogiltig roll på position ${position}.`);
    }
    const content = typeof record.content === 'string' ? record.content.trim() : '';
    if (!content) {
        throw new Error(`Meddelandetext saknas på position ${position}.`);
    }
    if (content.length > 8000) {
        throw new Error(`Meddelandet på position ${position} är för långt.`);
    }
    return { role: record.role, content };
}
