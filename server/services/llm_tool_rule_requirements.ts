/**
 * @file Kompakt kravöversikt från regelfilsinnehåll för LLM-verktyg.
 */

import { RequirementLookup } from '../../js/logic/requirement_lookup.js';

type RequirementDefLike = {
    id?: string;
    key?: string;
    title?: string;
    reference?: string;
};

export type CompactRequirement = {
    id: string;
    title: string;
    reference: string | null;
};

function parse_rule_content(raw: unknown): Record<string, unknown> | null {
    if (raw == null) return null;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw) as unknown;
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
        } catch {
            return null;
        }
    }
    return typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

export function compact_requirements_from_rule_content(rule_content_raw: unknown): CompactRequirement[] {
    const rule_content = parse_rule_content(rule_content_raw);
    if (!rule_content) return [];
    const lookup = RequirementLookup.from(rule_content.requirements);
    if (!lookup) return [];
    const raw = lookup.getRaw();
    const entries = Array.isArray(raw)
        ? raw.map((req) => {
              const def = req as RequirementDefLike;
              const id = String(def.key ?? def.id ?? '').trim();
              return id ? { id, def } : null;
          }).filter((e): e is { id: string; def: RequirementDefLike } => e !== null)
        : Object.entries(raw as Record<string, RequirementDefLike>).map(([key, def]) => ({
              id: String(def?.key ?? def?.id ?? key).trim(),
              def
          }));
    return entries
        .filter((e) => e.id)
        .map(({ id, def }) => ({
            id,
            title: typeof def.title === 'string' && def.title.trim() ? def.title.trim() : id,
            reference: typeof def.reference === 'string' && def.reference.trim() ? def.reference.trim() : null
        }));
}

export function resolve_requirement_title(rule_content_raw: unknown, requirement_id: string): string {
    const rule_content = parse_rule_content(rule_content_raw);
    if (!rule_content) return requirement_id;
    const lookup = RequirementLookup.from(rule_content.requirements);
    if (!lookup) return requirement_id;
    const def = lookup.findById(requirement_id) as RequirementDefLike | null;
    if (!def) return requirement_id;
    return typeof def.title === 'string' && def.title.trim() ? def.title.trim() : requirement_id;
}

export function resolve_rule_set_display_name(
    rule_content_raw: unknown,
    fallback_name: string | null | undefined
): string | null {
    const rule_content = parse_rule_content(rule_content_raw);
    const meta_title =
        rule_content &&
        rule_content.metadata &&
        typeof rule_content.metadata === 'object' &&
        typeof (rule_content.metadata as Record<string, unknown>).title === 'string'
            ? String((rule_content.metadata as Record<string, unknown>).title).trim()
            : '';
    if (meta_title) return meta_title;
    const name = typeof fallback_name === 'string' ? fallback_name.trim() : '';
    return name || null;
}
