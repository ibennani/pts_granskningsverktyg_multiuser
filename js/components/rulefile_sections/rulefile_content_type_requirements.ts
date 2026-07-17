/**
 * @fileoverview Koppling mellan krav och innehållstyp-id.
 */
import { normalize_requirements_to_record } from '../../logic/requirement_lookup.js';
import { get_requirement_display_label } from '../../logic/requirement_display_name.js';

export type ContentTypeRequirementRow = {
    key: string;
    display_label: string;
    requirement: Record<string, unknown>;
    linked: boolean;
};

export function build_content_type_requirement_rows(
    rule_file_content: Record<string, unknown>,
    content_type_id: string
): ContentTypeRequirementRow[] {
    const normalized_id = content_type_id.trim();
    const record = normalize_requirements_to_record(rule_file_content.requirements);
    return Object.entries(record)
        .map(([key, requirement]) => {
            const req = requirement as Record<string, unknown>;
            const content_types = Array.isArray(req.contentType) ? req.contentType : [];
            return {
                key,
                display_label: get_requirement_display_label(req),
                requirement: req,
                linked: normalized_id ? content_types.includes(normalized_id) : false,
            };
        })
        .sort((a, b) => a.display_label.localeCompare(b.display_label, 'sv'));
}

export function set_requirement_content_type_linked(
    rule_file_content: Record<string, unknown>,
    requirement_key: string,
    content_type_id: string,
    linked: boolean
): Record<string, unknown> {
    const normalized_id = content_type_id.trim();
    if (!normalized_id) return rule_file_content;

    const raw = rule_file_content.requirements;
    const record = normalize_requirements_to_record(raw);
    const existing = record[requirement_key];
    if (!existing || typeof existing !== 'object') return rule_file_content;

    const current = Array.isArray(existing.contentType) ? [...existing.contentType] : [];
    const index = current.indexOf(normalized_id);
    let next_types = current;

    if (linked && index === -1) {
        next_types = [...current, normalized_id];
    } else if (!linked && index >= 0) {
        next_types = current.filter((id) => id !== normalized_id);
    }

    const updated_requirement = { ...existing, contentType: next_types };
    const next_record = { ...record, [requirement_key]: updated_requirement };

    if (Array.isArray(raw)) {
        const updated_array = raw.map((row) => {
            if (!row || typeof row !== 'object') return row;
            const row_key = String((row as Record<string, unknown>).key ?? (row as Record<string, unknown>).id ?? '');
            return row_key === requirement_key ? updated_requirement : row;
        });
        return { ...rule_file_content, requirements: updated_array };
    }

    return { ...rule_file_content, requirements: next_record };
}
