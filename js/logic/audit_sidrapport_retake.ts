/**
 * @fileoverview Startar ny sidrapport från listan utan att ändra granskningsdelen.
 */
import { start_audit_snapshot_capture } from '../api/audit_snapshot_api.js';
import { should_attach_screenshot_when_creating_sidrapport } from '../../shared/sidrapport/capture_attach_policy.js';

type SampleForSidrapport = {
    id: string;
    url?: string | null;
    attachedMediaFilenames?: unknown;
};

export function resolve_sidrapport_capture_url(
    sample: SampleForSidrapport | undefined,
    fallback_url: string
): string {
    const from_sample = (sample?.url ?? '').trim();
    if (from_sample) return from_sample;
    return (fallback_url ?? '').trim();
}

export function is_sidrapport_retake_in_progress(row: {
    pendingAttempt?: { status: string } | null;
}): boolean {
    const status = row.pendingAttempt?.status;
    return status === 'queued' || status === 'capturing' || status === 'packaging';
}

export async function start_sidrapport_retake_for_sample(
    audit_id: string,
    sample: SampleForSidrapport,
    requested_url: string
): Promise<void> {
    const url = resolve_sidrapport_capture_url(sample, requested_url);
    if (!url) {
        throw new Error('missing_url');
    }

    await start_audit_snapshot_capture(audit_id, {
        captureId: crypto.randomUUID(),
        sampleId: String(sample.id),
        url,
        attachScreenshotToSample: should_attach_screenshot_when_creating_sidrapport(sample),
    });
}
