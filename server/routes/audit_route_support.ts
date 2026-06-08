/**
 * @fileoverview Gemensamma hjälpfunktioner för audit-routes (broadcast, tid, import-i18n).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { broadcast } from '../ws.js';

const __dirname_audits = path.dirname(fileURLToPath(import.meta.url));
const SV_I18N_PATH = path.join(__dirname_audits, '../../js/i18n/sv-SE.json');

let sv_i18n_cache: Record<string, string> | null = null;

function get_sv_messages(): Record<string, string> {
    if (!sv_i18n_cache) {
        sv_i18n_cache = JSON.parse(readFileSync(SV_I18N_PATH, 'utf8')) as Record<string, string>;
    }
    return sv_i18n_cache;
}

/** Översättning för importvalidering (samma nycklar som klientens i18n). */
export function audit_import_t(key: string, replacements: Record<string, string | number> = {}): string {
    const msgs = get_sv_messages();
    let s = msgs[key] ?? key;
    if (replacements && typeof replacements === 'object') {
        for (const [k, v] of Object.entries(replacements)) {
            s = s.split(`{${k}}`).join(String(v));
        }
    }
    return s;
}

export type AuditChangedPushPayload = {
    type: 'audits:changed';
    auditId?: string;
    version?: number;
    changeKind?: 'full';
};

export type AuditRequirementUpdatedPushPayload = {
    type: 'audit:requirement_updated';
    auditId: string;
    version: number;
    sampleId: string;
    requirementId: string;
    result: unknown;
    updatedBy?: string | null;
};

export function broadcast_audits_changed(
    audit_id: string | number | null | undefined,
    opts: { version?: number; changeKind?: 'full' } = {}
): void {
    const payload: AuditChangedPushPayload = {
        type: 'audits:changed',
        changeKind: opts.changeKind ?? 'full'
    };
    if (audit_id != null && audit_id !== '') {
        payload.auditId = String(audit_id);
    }
    if (opts.version != null && !Number.isNaN(Number(opts.version))) {
        payload.version = Number(opts.version);
    }
    broadcast(payload);
}

export function broadcast_audit_requirement_updated(params: {
    auditId: string | number;
    version: number;
    sampleId: string;
    requirementId: string;
    result: unknown;
    updatedBy?: string | null;
}): void {
    broadcast({
        type: 'audit:requirement_updated',
        auditId: String(params.auditId),
        version: Number(params.version),
        sampleId: String(params.sampleId),
        requirementId: String(params.requirementId),
        result: params.result,
        updatedBy: params.updatedBy ?? null
    } satisfies AuditRequirementUpdatedPushPayload);
}

export function broadcast_audit_locks_changed(audit_id: string | number): void {
    broadcast({ type: 'audits:locks_changed', auditId: String(audit_id) });
}

export function extract_min_max_timestamps(samples: unknown): { minTime: string | null; maxTime: string | null } {
    let minTime: string | null = null;
    let maxTime: string | null = null;
    if (!samples || !Array.isArray(samples)) return { minTime, maxTime };
    samples.forEach((sample: { requirementResults?: Record<string, unknown> }) => {
        const reqResults = sample?.requirementResults || {};
        Object.values(reqResults).forEach((reqResult: unknown) => {
            const rr = reqResult as {
                lastStatusUpdate?: string;
                checkResults?: Record<string, { timestamp?: string; passCriteria?: Record<string, { timestamp?: string }> }>;
            };
            if (rr?.lastStatusUpdate) {
                const t = rr.lastStatusUpdate;
                if (!minTime || t < minTime) minTime = t;
                if (!maxTime || t > maxTime) maxTime = t;
            }
            Object.values(rr?.checkResults || {}).forEach((checkResult) => {
                if (checkResult?.timestamp) {
                    const t = checkResult.timestamp;
                    if (!minTime || t < minTime) minTime = t;
                    if (!maxTime || t > maxTime) maxTime = t;
                }
                Object.values(checkResult?.passCriteria || {}).forEach((pcResult) => {
                    if (pcResult?.timestamp) {
                        const t = pcResult.timestamp;
                        if (!minTime || t < minTime) minTime = t;
                        if (!maxTime || t > maxTime) maxTime = t;
                    }
                });
            });
        });
    });
    return { minTime, maxTime };
}

export function count_business_days(startDate: string, endDate: string): number | null {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
    let count = 0;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(0, 0, 0, 0);
    while (d <= endNorm) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++;
        d.setDate(d.getDate() + 1);
    }
    return count;
}
