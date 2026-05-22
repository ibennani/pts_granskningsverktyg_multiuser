/**
 * @fileoverview Mappar databasrad från granskningslistan till API-objekt (progress, bristindex m.m.).
 */

import { compute_audit_progress_percent } from '../../js/logic/audit_list_progress.js';
import { calculateQualityScore } from '../../js/logic/ScoreCalculator.js';
import { count_business_days, extract_min_max_timestamps } from './audit_route_support.js';

type IndexRow = {
    id: string;
    rule_set_id?: string | null;
    status?: string;
    metadata?: Record<string, unknown> & { startTime?: string; endTime?: string };
    version?: number;
    rule_set_name?: string;
    last_updated_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    samples?: unknown;
    rule_content?: unknown;
};

export function map_audit_index_row_to_list_item(row: IndexRow): Record<string, unknown> {
    const out: Record<string, unknown> = {
        id: row.id,
        rule_set_id: row.rule_set_id,
        status: row.status,
        metadata: row.metadata || {},
        version: row.version,
        rule_set_name: row.rule_set_name,
        last_updated_by: row.last_updated_by || null,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
    const metadata = row.metadata || {};
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
