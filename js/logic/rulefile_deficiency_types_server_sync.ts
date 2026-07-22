/**
 * @fileoverview Synkar bristtyper från serverns regelfilsinnehåll till klientstate vid behov.
 */
import { get_rule } from '../api/client.js';
import { normalize_requirements_to_record } from './requirement_lookup.js';

type RequirementRecord = Record<string, Record<string, unknown>>;

function parse_rule_content(content: unknown): Record<string, unknown> | null {
    if (!content || typeof content !== 'object') return null;
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
        } catch {
            return null;
        }
    }
    return content as Record<string, unknown>;
}

function read_deficiency_primary(deficiency_type: unknown): string {
    if (!deficiency_type || typeof deficiency_type !== 'object') return '';
    const primary = (deficiency_type as Record<string, unknown>).PrimaryText;
    return typeof primary === 'string' ? primary.trim() : '';
}

function clone_deficiency_type(deficiency_type: unknown): Record<string, string> {
    if (!deficiency_type || typeof deficiency_type !== 'object') {
        return { PrimaryText: '', SecondaryText: '' };
    }
    const node = deficiency_type as Record<string, unknown>;
    return {
        PrimaryText: typeof node.PrimaryText === 'string' ? node.PrimaryText : '',
        SecondaryText: typeof node.SecondaryText === 'string' ? node.SecondaryText : '',
    };
}

function merge_requirement_deficiency_types(
    local_requirements: RequirementRecord,
    remote_requirements: RequirementRecord
): { requirements: RequirementRecord; changed: boolean } {
    let changed = false;
    const requirements: RequirementRecord = { ...local_requirements };

    for (const [key, local_req] of Object.entries(requirements)) {
        const remote_req = remote_requirements[key];
        if (!remote_req || typeof remote_req !== 'object') continue;

        const local_primary = read_deficiency_primary(local_req.DeficiencyType);
        const remote_primary = read_deficiency_primary(remote_req.DeficiencyType);
        if (local_primary || !remote_primary) continue;

        requirements[key] = {
            ...local_req,
            DeficiencyType: clone_deficiency_type(remote_req.DeficiencyType),
        };
        changed = true;
    }

    return { requirements, changed };
}

/**
 * Hämtar bristtyper från servern om lokalt utkast saknar PrimaryText men servern har data.
 */
export async function merge_deficiency_types_from_server_if_missing(
    rule_set_id: string | null | undefined,
    rule_file_content: Record<string, unknown> | null | undefined
): Promise<{ content: Record<string, unknown>; changed: boolean }> {
    if (!rule_set_id || !rule_file_content) {
        return { content: rule_file_content || {}, changed: false };
    }

    try {
        const rule_row = await get_rule(String(rule_set_id));
        const remote_content = parse_rule_content(rule_row?.content);
        if (!remote_content) {
            return { content: rule_file_content, changed: false };
        }

        const local_reqs = normalize_requirements_to_record(rule_file_content.requirements) as RequirementRecord;
        const remote_reqs = normalize_requirements_to_record(remote_content.requirements) as RequirementRecord;
        const merged = merge_requirement_deficiency_types(local_reqs, remote_reqs);

        if (!merged.changed) {
            return { content: rule_file_content, changed: false };
        }

        return {
            content: {
                ...rule_file_content,
                requirements: merged.requirements,
            },
            changed: true,
        };
    } catch {
        return { content: rule_file_content, changed: false };
    }
}
