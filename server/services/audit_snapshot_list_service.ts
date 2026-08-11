/**
 * @fileoverview Bygger snapshot-lista per granskningsdel för UI.
 */
import {
    list_audit_snapshots_for_audit,
    type AuditSnapshotRow,
} from '../repositories/audit_snapshot_repository.js';
import type { AuditSnapshotListItem } from '../schemas/audit_snapshot.js';

type SampleLike = {
    id: string;
    description?: string;
    url?: string;
};

function is_processing_status(status: string): boolean {
    return status === 'queued' || status === 'capturing' || status === 'packaging';
}

function sample_has_url(sample: SampleLike | undefined): boolean {
    return Boolean((sample?.url ?? '').trim());
}

function parse_warnings_json(
    raw: unknown
): Array<{ code: string; message: string }> {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const code = 'code' in entry ? String(entry.code) : '';
            const message = 'message' in entry ? String(entry.message) : '';
            if (!code) return null;
            return { code, message };
        })
        .filter((entry): entry is { code: string; message: string } => entry !== null);
}

export async function build_audit_snapshot_list(
    audit_id: string,
    samples: SampleLike[]
): Promise<AuditSnapshotListItem[]> {
    const rows = await list_audit_snapshots_for_audit(audit_id);
    const by_sample = new Map<string, AuditSnapshotRow[]>();

    for (const row of rows) {
        const list = by_sample.get(row.sample_id) ?? [];
        list.push(row);
        by_sample.set(row.sample_id, list);
    }

    const sample_ids = new Set<string>();
    for (const sample of samples) {
        if (sample_has_url(sample)) {
            sample_ids.add(String(sample.id));
        }
    }
    for (const sid of by_sample.keys()) {
        const sample = samples.find((s) => String(s.id) === sid);
        if (sample && !sample_has_url(sample)) {
            continue;
        }
        sample_ids.add(sid);
    }

    const items: AuditSnapshotListItem[] = [];

    for (const sample_id of sample_ids) {
        const sample = samples.find((s) => String(s.id) === sample_id);
        const sample_rows = (by_sample.get(sample_id) ?? []).sort(
            (a, b) => b.created_at.getTime() - a.created_at.getTime()
        );

        const current_ready = sample_rows.find((r) => r.status === 'ready') ?? null;
        const pending = sample_rows.find((r) => is_processing_status(r.status)) ?? null;
        const latest_failed =
            sample_rows.find((r) => r.status === 'failed' && r.id !== pending?.id) ?? null;

        const pending_attempt =
            pending ??
            (latest_failed && current_ready
                ? {
                      ...latest_failed,
                      status: latest_failed.status as 'failed',
                  }
                : latest_failed);

        items.push({
            sampleId: sample_id,
            sampleDescription: sample?.description ?? undefined,
            requestedUrl: pending?.requested_url ?? current_ready?.requested_url ?? sample?.url ?? '',
            pageTitle: pending?.page_title ?? current_ready?.page_title ?? null,
            currentReady: current_ready
                ? {
                      snapshotId: current_ready.id,
                      capturedAt: (current_ready.completed_at ?? current_ready.created_at).toISOString(),
                      status: 'ready',
                      warningCount: current_ready.warning_count,
                      warnings: parse_warnings_json(current_ready.warnings_json),
                      sizeBytes: current_ready.size_bytes,
                  }
                : null,
            pendingAttempt: pending_attempt
                ? {
                      snapshotId: pending_attempt.id,
                      status: pending_attempt.status,
                      error: pending_attempt.error,
                      warningCount: pending_attempt.warning_count,
                  }
                : null,
        });
    }

    return items.sort((a, b) => {
        const a_desc = a.sampleDescription ?? a.sampleId;
        const b_desc = b.sampleDescription ?? b.sampleId;
        return a_desc.localeCompare(b_desc, 'sv');
    });
}
