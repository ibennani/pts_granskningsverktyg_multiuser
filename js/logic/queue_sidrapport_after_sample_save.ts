/**
 * @fileoverview Köar full sidrapport i bakgrunden efter manuell sparning av granskningsdel.
 */
import { list_audit_snapshots } from '../api/audit_snapshot_api.js';
import { get_auth_token } from '../api/client.js';
import { resolve_sample_vocab } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';
import {
    is_sidrapport_retake_in_progress,
    start_sidrapport_retake_for_sample,
    type SampleForSidrapport,
} from './audit_sidrapport_retake.js';
import { sync_to_server_now } from './server_sync.js';

export type SampleSaveSnapshotInput = {
    sampleId: string;
    url?: string | null;
    sampleCategory?: string | null;
    attachedMediaFilenames?: unknown;
};

export type QueueSidrapportAfterSampleSaveDeps = {
    getState: () => {
        auditId?: string | null;
        ruleFileContent?: unknown;
    } | null;
    dispatch: (action: unknown) => void;
};

function sample_category_has_url(
    rule_file_content: unknown,
    category_id: string | null | undefined
): boolean {
    if (!category_id) {
        return false;
    }
    const vocab = resolve_sample_vocab(rule_file_content);
    const category = vocab.sampleCategories?.find(
        (entry) => String(entry.id) === String(category_id)
    );
    return Boolean(category?.hasUrl);
}

export function should_queue_sidrapport_for_saved_sample(
    sample: SampleSaveSnapshotInput,
    rule_file_content: unknown
): boolean {
    const url = String(sample.url ?? '').trim();
    if (!url) {
        return false;
    }
    return sample_category_has_url(rule_file_content, sample.sampleCategory);
}

export async function queue_sidrapport_after_sample_save(
    deps: QueueSidrapportAfterSampleSaveDeps,
    sample: SampleSaveSnapshotInput
): Promise<void> {
    const state = deps.getState?.();
    const rule_file_metadata = state?.ruleFileContent as { metadata?: unknown } | undefined;
    if (!should_queue_sidrapport_for_saved_sample(sample, rule_file_metadata?.metadata)) {
        return;
    }
    if (!get_auth_token()) {
        return;
    }

    let audit_id = state?.auditId ? String(state.auditId) : null;
    if (!audit_id) {
        return;
    }

    try {
        await sync_to_server_now(deps.getState, deps.dispatch);
        audit_id = deps.getState?.()?.auditId ? String(deps.getState()!.auditId) : audit_id;
    } catch {
        return;
    }

    try {
        const list = await list_audit_snapshots(audit_id);
        const existing = list.items.find(
            (item) => String(item.sampleId) === String(sample.sampleId)
        );
        if (existing && is_sidrapport_retake_in_progress(existing)) {
            return;
        }

        const sample_for_capture: SampleForSidrapport = {
            id: String(sample.sampleId),
            url: sample.url,
            attachedMediaFilenames: sample.attachedMediaFilenames,
        };

        void start_sidrapport_retake_for_sample(audit_id, sample_for_capture).catch(() => {
            // Bakgrund — fel visas i Sidrapporter-vyn
        });
    } catch {
        // Bakgrund — tyst fel
    }
}
