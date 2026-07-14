/**
 * @fileoverview Jämför handläggar-Word mot aktuell granskning.
 */
import { collect_observation_export_deficiencies } from '../export/export_observation_texts_collect.js';
import { extractDeficiencyNumber } from '../export/export_format_helpers.js';
import { traverse_all_pass_criteria } from '../utils/traverse_audit_data.js';
import type {
    DeficiencyLocation,
    ObservationWordDiffItem,
    ObservationWordImportDiffResult,
    ObservationWordImportParseResult,
    ParsedHandlingBlock,
} from './observation_word_import_types.js';

/**
 * Tar bort markdown-markering så att export och Word-omläsning kan jämföras.
 */
function strip_markdown_to_plain(text: string): string {
    let s = text;
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    for (let i = 0; i < 3; i += 1) {
        s = s.replace(/\*\*(.+?)\*\*/gs, '$1');
        s = s.replace(/__(.+?)__/gs, '$1');
        s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
        s = s.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1');
    }
    s = s.replace(/`([^`\n]+)`/g, '$1');
    return s;
}

/**
 * Normaliserar observationstext för jämförelse (granskning vs Word efter export).
 */
export function normalize_observation_text_for_diff(text: string): string {
    let s = String(text || '')
        .replace(/\u00A0/g, ' ')
        .replace(/\u200B/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    s = strip_markdown_to_plain(s);
    s = s
        .replace(/^[\s]*[-*•]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '');

    const lines = s
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line.length > 0);

    return lines.join('\n');
}

function build_deficiency_location_index(audit: unknown): Map<string, DeficiencyLocation> {
    const by_id_number = new Map<string, DeficiencyLocation>();
    traverse_all_pass_criteria(audit as import('../utils/traverse_audit_data.js').AuditStateLike, (ctx) => {
        const pc_obj = ctx.pc_result;
        if (!pc_obj || pc_obj.status !== 'failed' || !pc_obj.deficiencyId) return;
        const id_number = extractDeficiencyNumber(pc_obj.deficiencyId);
        if (!id_number || by_id_number.has(id_number)) return;
        by_id_number.set(id_number, {
            deficiency_id: String(pc_obj.deficiencyId),
            sample_id: String(ctx.sample.id ?? ''),
            requirement_id: String(ctx.req_key),
            check_id: String(ctx.check_key),
            pc_id: String(ctx.pc_key),
        });
    });
    return by_id_number;
}

function build_word_block_map(blocks: ParsedHandlingBlock[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const block of blocks) {
        map.set(block.id_number, block.observation_markdown);
    }
    return map;
}

/**
 * Bygger diff mellan granskning och parsad Word-fil.
 */
export function build_observation_word_import_diff(
    audit: unknown,
    parse_result: ObservationWordImportParseResult
): ObservationWordImportDiffResult {
    const empty_summary = {
        total_in_audit: 0,
        total_in_word: 0,
        unchanged_count: 0,
        changed_count: 0,
        missing_in_word_count: 0,
        unknown_in_word_count: 0,
    };

    if (!parse_result.ok) {
        return {
            parse_ok: false,
            can_import: false,
            summary: empty_summary,
            items: [],
            parse_error_key: parse_result.error_key,
        };
    }

    const audit_entries = collect_observation_export_deficiencies(audit);
    const location_index = build_deficiency_location_index(audit);
    const word_map = build_word_block_map(parse_result.blocks);
    const items: ObservationWordDiffItem[] = [];

    for (const entry of audit_entries) {
        const id_number = extractDeficiencyNumber(entry.deficiencyId);
        if (!id_number) continue;
        const word_text = word_map.get(id_number);
        const audit_text = entry.observationDetail || '';

        if (word_text === undefined) {
            items.push({
                id_number,
                deficiency_id: entry.deficiencyId,
                status: 'missing_in_word',
                audit_text,
            });
            continue;
        }

        const normalized_audit = normalize_observation_text_for_diff(audit_text);
        const normalized_word = normalize_observation_text_for_diff(word_text);
        if (normalized_audit === normalized_word) {
            items.push({
                id_number,
                deficiency_id: entry.deficiencyId,
                status: 'unchanged',
                audit_text,
                word_text,
            });
        } else {
            items.push({
                id_number,
                deficiency_id: entry.deficiencyId,
                status: 'changed',
                audit_text,
                word_text,
            });
        }
    }

    for (const [id_number, word_text] of word_map.entries()) {
        if (location_index.has(id_number)) continue;
        items.push({
            id_number,
            status: 'unknown_in_word',
            word_text,
        });
    }

    items.sort((a, b) => {
        const num_a = parseInt(a.id_number, 10);
        const num_b = parseInt(b.id_number, 10);
        if (Number.isFinite(num_a) && Number.isFinite(num_b) && num_a !== num_b) {
            return num_a - num_b;
        }
        return a.id_number.localeCompare(b.id_number, undefined, { numeric: true });
    });

    const summary = {
        total_in_audit: audit_entries.length,
        total_in_word: word_map.size,
        unchanged_count: items.filter((item) => item.status === 'unchanged').length,
        changed_count: items.filter((item) => item.status === 'changed').length,
        missing_in_word_count: items.filter((item) => item.status === 'missing_in_word').length,
        unknown_in_word_count: items.filter((item) => item.status === 'unknown_in_word').length,
    };

    return {
        parse_ok: true,
        can_import: summary.unknown_in_word_count === 0,
        summary,
        items,
    };
}

export { build_deficiency_location_index };
