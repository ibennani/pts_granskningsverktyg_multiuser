/**
 * @fileoverview Laddar och validerar publicerad regelfil för ny granskning.
 */

import { migrate_rulefile_to_new_structure } from './rulefile_migration_logic.js';

type GetRuleFn = (id: string) => Promise<Record<string, unknown>>;
type MigrateFn = typeof migrate_rulefile_to_new_structure;
type ValidateFn = (content: unknown) => { isValid?: boolean; message?: string };

export type LoadPublishedRuleResult =
    | { ok: true; content: Record<string, unknown>; rule_id: string }
    | { ok: false; error: string };

export async function load_published_rule_content(
    rule_id: string,
    deps: {
        get_rule: GetRuleFn;
        migrate: MigrateFn;
        validate: ValidateFn;
        Translation: { t?: (key: string) => string };
    }
): Promise<LoadPublishedRuleResult> {
    const t = deps.Translation?.t ?? ((key: string) => key);
    try {
        const rule_row = await deps.get_rule(rule_id);
        const row = rule_row as { published_content?: unknown; content?: unknown };
        let content: unknown = row?.published_content ?? row?.content;
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            } catch {
                content = null;
            }
        }
        if (!content || typeof content !== 'object') {
            return { ok: false, error: t('rule_file_invalid_json') };
        }
        const migrated_content = deps.migrate(content, { Translation: deps.Translation });
        const validation_result = deps.validate?.(migrated_content);
        if (!validation_result?.isValid) {
            return {
                ok: false,
                error: validation_result?.message || t('rule_file_invalid_json'),
            };
        }
        return {
            ok: true,
            content: migrated_content as Record<string, unknown>,
            rule_id,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message || t('audit_load_rule_error') };
    }
}
