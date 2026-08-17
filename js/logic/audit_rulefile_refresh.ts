/**
 * @fileoverview Hämtar senaste publicerade regelfil och uppdaterar gransknings-state.
 */

import { get_rule } from '../api/client.js';
import { migrate_rulefile_to_new_structure } from './rulefile_migration_logic.js';
import { load_published_rule_content } from './new_audit_rule_loader.js';
import {
    resolve_effective_rule_set_id_for_audit,
    with_bound_rule_metadata,
} from './audit_bound_rule_metadata.js';

type DispatchFn = (action: { type: string; payload?: Record<string, unknown> }) => void;

type AuditStateSlice = {
    auditStatus?: string;
    ruleSetId?: string | null;
    auditMetadata?: Record<string, unknown>;
    ruleFileContent?: unknown;
};

type RefreshDeps = {
    get_rule?: typeof get_rule;
    migrate?: typeof migrate_rulefile_to_new_structure;
    validate?: (content: unknown) => { isValid?: boolean; message?: string };
    Translation?: { t?: (key: string) => string };
};

function read_rule_version(content: unknown): string {
    const meta = (content as { metadata?: { version?: unknown } } | null)?.metadata;
    return String(meta?.version ?? '').trim();
}

/**
 * Hämtar publicerad regelfil för bundet ruleSetId och skriver till state (inkl. bound-metadata).
 */
export async function refresh_published_rulefile_in_audit_state(
    get_state_fn: () => AuditStateSlice | null | undefined,
    dispatch_fn: DispatchFn,
    store_action_types: { UPDATE_NEW_AUDIT_RULEFILE: string; UPDATE_METADATA: string; UPDATE_RULEFILE_CONTENT: string },
    deps: RefreshDeps = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
    const state = get_state_fn();
    if (!state) {
        return { ok: false, error: 'missing_state' };
    }

    const rule_set_id = resolve_effective_rule_set_id_for_audit(state);
    if (!rule_set_id) {
        return { ok: false, error: 'missing_rule_set_id' };
    }

    const get_rule_fn = deps.get_rule ?? get_rule;
    const migrate_fn = deps.migrate ?? migrate_rulefile_to_new_structure;
    const validate_fn =
        deps.validate ??
        (() => ({ isValid: false, message: 'validation_unavailable' }));
    const translation = deps.Translation ?? { t: (key: string) => key };

    const loaded = await load_published_rule_content(rule_set_id, {
        get_rule: get_rule_fn,
        migrate: migrate_fn,
        validate: validate_fn,
        Translation: translation,
    });
    if (!loaded.ok) {
        return { ok: false, error: loaded.error };
    }

    const version = read_rule_version(loaded.content);
    const metadata = with_bound_rule_metadata(
        { ...(state.auditMetadata || {}) },
        loaded.rule_id,
        version
    );

    const is_not_started = state.auditStatus === 'not_started';
    const rule_action_type = is_not_started
        ? store_action_types.UPDATE_NEW_AUDIT_RULEFILE
        : store_action_types.UPDATE_RULEFILE_CONTENT;

    await dispatch_fn({
        type: rule_action_type,
        payload: is_not_started
            ? {
                ruleFileContent: loaded.content,
                ruleSetId: loaded.rule_id,
                skip_render: true,
            }
            : {
                ruleFileContent: loaded.content,
                skip_render: true,
            },
    });

    await dispatch_fn({
        type: store_action_types.UPDATE_METADATA,
        payload: {
            ...metadata,
            skip_render: true,
            skip_server_sync: true,
        },
    });

    return { ok: true };
}
