/**
 * @fileoverview Klienthjälp för overlay av granskningstyper från publicerad regelfil.
 */

import { get_rule, get_rules } from '../api/client.js';
import {
    apply_audit_type_overlay_to_rule_content,
    parse_rule_content_value,
    snapshot_lacks_audit_types,
} from '../../shared/audit/audit_type_catalog.js';
import { resolve_audit_types } from '../../shared/rulefile/rulefile_audit_types.js';
import {
    build_default_published_audit_types_content,
    pick_published_rule_row_by_monitoring_kind,
    read_rule_set_id_candidates,
    resolve_monitoring_kind_from_rule_content,
} from '../../shared/audit/audit_type_rule_set_resolve.js';
import { type PublishedRuleRow } from './published_monitoring_rule_options.js';

export async function fetch_published_rule_content_for_audit(
    rule_set_id: string | number | null | undefined
): Promise<unknown | null> {
    if (rule_set_id === null || rule_set_id === undefined || String(rule_set_id).trim() === '') {
        return null;
    }
    try {
        const rule = await get_rule(String(rule_set_id));
        return parse_rule_content_value(rule?.published_content ?? rule?.content);
    } catch {
        return null;
    }
}

export function apply_audit_type_overlay_with_published(
    rule_file_content: unknown,
    published_rule_content: unknown | null | undefined
): unknown {
    const snapshot = parse_rule_content_value(rule_file_content);
    if (!snapshot) {
        return rule_file_content;
    }
    const published = parse_rule_content_value(published_rule_content);
    return apply_audit_type_overlay_to_rule_content(snapshot, published);
}

export async function resolve_published_rule_content_for_audit_state(
    state: Record<string, unknown>
): Promise<{ published: unknown | null; resolved_rule_set_id: string | null }> {
    const snapshot = parse_rule_content_value(state.ruleFileContent);
    if (!snapshot) {
        return { published: null, resolved_rule_set_id: null };
    }

    const candidates = read_rule_set_id_candidates(
        state.ruleSetId ?? state.rule_set_id,
        snapshot
    );
    for (const rule_set_id of candidates) {
        const published = await fetch_published_rule_content_for_audit(rule_set_id);
        if (published && resolve_audit_types((published as { metadata?: unknown }).metadata).length > 0) {
            return { published, resolved_rule_set_id: rule_set_id };
        }
    }

    const kind = resolve_monitoring_kind_from_rule_content(snapshot);
    if (kind !== 'unknown') {
        try {
            const rules = (await get_rules()) as PublishedRuleRow[];
            const match = pick_published_rule_row_by_monitoring_kind(rules, kind);
            if (match?.id) {
                const published = await fetch_published_rule_content_for_audit(match.id);
                if (published && resolve_audit_types((published as { metadata?: unknown }).metadata).length > 0) {
                    return { published, resolved_rule_set_id: match.id };
                }
            }
        } catch {
            // Fortsätt till standardtyper
        }
    }

    return { published: null, resolved_rule_set_id: null };
}

export async function enrich_audit_state_with_audit_type_overlay(
    state: Record<string, unknown> | null | undefined
): Promise<Record<string, unknown>> {
    if (!state || typeof state !== 'object') {
        return state ?? {};
    }
    if (!state.ruleFileContent) {
        return state;
    }

    const { published, resolved_rule_set_id } = await resolve_published_rule_content_for_audit_state(state);
    let effective = apply_audit_type_overlay_with_published(
        state.ruleFileContent,
        published ?? build_default_published_audit_types_content()
    );
    if (snapshot_lacks_audit_types(effective)) {
        effective = apply_audit_type_overlay_with_published(
            state.ruleFileContent,
            build_default_published_audit_types_content()
        );
    }

    const next_state: Record<string, unknown> = {
        ...state,
        ruleFileContent: effective,
    };
    if (!next_state.ruleSetId && !next_state.rule_set_id && resolved_rule_set_id) {
        next_state.ruleSetId = resolved_rule_set_id;
    }
    return next_state;
}
