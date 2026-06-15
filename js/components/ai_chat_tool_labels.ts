/**
 * @file Översättningsnycklar för LLM-verktygsnamn i chattvyn.
 */

const TOOL_I18N_KEYS: Record<string, string> = {
    list_audits: 'ai_chat_tool_list_audits',
    get_audit: 'ai_chat_tool_get_audit',
    list_rule_sets: 'ai_chat_tool_list_rule_sets',
    get_rule_set: 'ai_chat_tool_get_rule_set',
    get_statistics: 'ai_chat_tool_get_statistics',
    update_audit_metadata: 'ai_chat_tool_update_audit_metadata',
    update_requirement_result: 'ai_chat_tool_update_requirement_result'
};

export function resolve_tool_activity_label(
    tool_name: string | null,
    translate: (key: string) => string
): string | null {
    if (!tool_name) return null;
    const key = TOOL_I18N_KEYS[tool_name];
    return key ? translate(key) : tool_name;
}
