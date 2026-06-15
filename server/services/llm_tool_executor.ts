/**
 * @file Kör LLM-verktyg mot databasen med samma behörighet som inloggad användare.
 */

import type { LlmToolContext } from './llm_tool_context.js';
import {
    tool_get_audit,
    tool_get_rule_set,
    tool_get_statistics,
    tool_list_audits,
    tool_list_rule_sets
} from './llm_tool_read_handlers.js';
import {
    tool_update_audit_metadata,
    tool_update_requirement_result
} from './llm_tool_write_handlers.js';

function parse_tool_arguments(raw: unknown): Record<string, unknown> {
    if (raw == null) return {};
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw) as unknown;
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
        } catch {
            throw new Error('Verktygsargument var ogiltig JSON.');
        }
    }
    if (typeof raw === 'object') {
        return raw as Record<string, unknown>;
    }
    return {};
}

export async function execute_llm_tool(
    tool_name: string,
    raw_arguments: unknown,
    context: LlmToolContext
): Promise<string> {
    const args = parse_tool_arguments(raw_arguments);
    const user_name = context.user.name || null;

    switch (tool_name) {
        case 'list_audits':
            return tool_list_audits({ status: typeof args.status === 'string' ? args.status : undefined });
        case 'get_audit':
            return tool_get_audit({ audit_id: typeof args.audit_id === 'string' ? args.audit_id : undefined });
        case 'list_rule_sets':
            return tool_list_rule_sets();
        case 'get_rule_set':
            return tool_get_rule_set({
                rule_set_id: typeof args.rule_set_id === 'string' ? args.rule_set_id : undefined
            });
        case 'get_statistics':
            return tool_get_statistics();
        case 'update_audit_metadata':
            return tool_update_audit_metadata(
                {
                    audit_id: typeof args.audit_id === 'string' ? args.audit_id : undefined,
                    metadata:
                        args.metadata && typeof args.metadata === 'object'
                            ? (args.metadata as Record<string, unknown>)
                            : undefined
                },
                user_name
            );
        case 'update_requirement_result':
            return tool_update_requirement_result(
                {
                    audit_id: typeof args.audit_id === 'string' ? args.audit_id : undefined,
                    sample_id: typeof args.sample_id === 'string' ? args.sample_id : undefined,
                    requirement_id: typeof args.requirement_id === 'string' ? args.requirement_id : undefined,
                    status: typeof args.status === 'string' ? args.status : undefined,
                    observation: typeof args.observation === 'string' ? args.observation : undefined
                },
                user_name
            );
        default:
            throw new Error(`Okänt verktyg: ${tool_name}`);
    }
}
