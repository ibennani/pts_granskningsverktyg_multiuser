/**
 * @file Kontext för LLM-verktyg (inloggad användare och valfri fokusgranskning).
 */

export interface LlmToolUser {
    id: string;
    name: string;
    is_admin?: boolean;
}

export interface LlmChatClientContext {
    audit_id?: string | null;
    rule_set_id?: string | null;
}

export interface LlmToolContext {
    user: LlmToolUser;
    client: LlmChatClientContext;
}

export function normalize_client_context(raw: unknown): LlmChatClientContext {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const input = raw as Record<string, unknown>;
    const audit_id = typeof input.audit_id === 'string' ? input.audit_id.trim() : '';
    const rule_set_id = typeof input.rule_set_id === 'string' ? input.rule_set_id.trim() : '';
    return {
        audit_id: audit_id || null,
        rule_set_id: rule_set_id || null
    };
}
