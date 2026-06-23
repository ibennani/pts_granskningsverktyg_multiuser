/**
 * @fileoverview Mappar databasrad från granskningslistan till API-objekt (progress, bristindex m.m.).
 */

import { compute_audit_progress_percent } from '../../js/logic/audit_list_progress.js';
import { resolve_audit_list_last_updated_at } from '../../js/logic/audit_list_last_updated.js';
import { calculateQualityScore } from '../../js/logic/ScoreCalculator.js';
import { AuditIndexRowSchema, type AuditIndexRow } from '../schemas/audit_db_rows.js';
import { safe_parse_db_row } from '../utils/zod_boundary.js';
import { count_business_days, extract_min_max_timestamps } from './audit_route_support.js';

function build_minimal_list_item(row: unknown): Record<string, unknown> {
    const fallback_id =
        row && typeof row === 'object' && row !== null && 'id' in row ? String((row as { id: unknown }).id) : null;
    return {
        id: fallback_id,
        rule_set_id: null,
        status: null,
        metadata: {},
        version: null,
        rule_set_name: null,
        last_updated_by: null,
        created_at: null,
        updated_at: null,
        last_updated_display_at: null,
        business_days: null,
        progress: null,
        deficiency_index: null
    };
}

export function map_audit_index_row_to_list_item(row: unknown): Record<string, unknown> {
    const parsed = safe_parse_db_row(AuditIndexRowSchema, row);
    if (!parsed) {
        console.warn('[audits] Ogiltig indexrad, returnerar minimal listpost');
        return build_minimal_list_item(row);
    }
    return map_valid_audit_index_row(parsed);
}

function map_valid_audit_index_row(row: AuditIndexRow): Record<string, unknown> {
    const metadata =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};
    const out: Record<string, unknown> = {
        id: row.id,
        rule_set_id: row.rule_set_id,
        status: row.status,
        metadata,
        version: row.version,
        rule_set_name: row.rule_set_name,
        last_updated_by: row.last_updated_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_updated_display_at: resolve_audit_list_last_updated_at({
            status: row.status,
            metadata,
            samples: row.samples,
            updated_at: row.updated_at ?? null
        })
    };
    const samples = row.samples;
    const { minTime, maxTime } = extract_min_max_timestamps(samples);
    const firstTs = minTime || (metadata.startTime as string) || row.created_at;
    const lastTs = maxTime || (metadata.endTime as string) || (row.status === 'locked' ? row.updated_at : null);
    const endForCalc = lastTs || new Date().toISOString();
    out.business_days = firstTs ? count_business_days(firstTs, endForCalc) : null;
    const samples_parsed =
        typeof row.samples === 'string'
            ? (() => {
                  try {
                      return JSON.parse(row.samples);
                  } catch {
                      return null;
                  }
              })()
            : row.samples;

    if (row.rule_content && samples_parsed) {
        try {
            let rule_content: unknown = row.rule_content;
            if (typeof rule_content === 'string') {
                rule_content = JSON.parse(rule_content);
            }
            const full_state = {
                ruleFileContent: rule_content,
                auditStatus: row.status,
                samples: samples_parsed
            };
            out.progress = compute_audit_progress_percent(full_state);
            const score = calculateQualityScore(full_state as never);
            out.deficiency_index =
                score != null && typeof score.totalScore === 'number' ? Math.round(score.totalScore * 10) / 10 : null;
        } catch (e) {
            const err = e as Error;
            console.warn('[audits] Beräkning progress/bristindex misslyckades för audit', row.id, ':', err.message);
            out.progress = null;
            out.deficiency_index = null;
        }
    } else {
        out.progress = null;
        out.deficiency_index = null;
    }
    return out;
}
