/**
 * @fileoverview Orkestrator för bulkimport av URL-lista via befintlig capture-kö.
 */
import {
    start_audit_snapshot_capture,
    fetch_snapshot_analysis_summary,
    list_audit_snapshots,
    type AuditSnapshotCaptureResponse,
} from '../api/audit_snapshot_api.js';
import { classify_sample_page_type } from '../../shared/logic/sample_page_type_classifier.js';
import { queue_sidrapport_after_sample_save } from './queue_sidrapport_after_sample_save.js';
import { sync_to_server_now } from './server_sync.js';

export type BulkImportRowStatus =
    | 'waiting'
    | 'fetching'
    | 'title_ready'
    | 'screenshot_ready'
    | 'sidrapport_queued'
    | 'sidrapport_ready'
    | 'needs_action'
    | 'saved'
    | 'failed';

export type BulkImportPreparedRow = {
    row_id: string;
    url: string;
    status: BulkImportRowStatus;
    error_message: string | null;
    page_title: string | null;
    screenshot_filename: string | null;
    sample_id: string | null;
    capture_id: string | null;
    suggested_sample_type_id: string | null;
    suggested_sample_type_confidence: number;
    detected_content_type_ids: string[];
    selected_content_type_ids: string[];
    include_in_save: boolean;
};

export type BulkImportOrchestratorDeps = {
    getState: () => {
        auditId?: string | null;
        ruleFileContent?: unknown;
        auditStatus?: string;
    } | null;
    dispatch: (action: { type: string; payload?: unknown }) => void;
    StoreActionTypes: { ADD_SAMPLE: string; UPDATE_SAMPLE?: string };
    generate_uuid: () => string;
    add_protocol_if_missing?: (url: string) => string;
    on_row_updated: (row: BulkImportPreparedRow) => void;
    on_progress_message?: (message: string) => void;
    wait_for_snapshot_ready: (
        audit_id: string,
        capture_id: string,
        timeout_ms: number
    ) => Promise<boolean>;
    signal?: AbortSignal;
};

function extract_detected_content_type_ids(summary: unknown): string[] {
    const content_types = (summary as { contentTypes?: { results?: Array<{ contentTypeId?: string; detected?: boolean }> } } | null)
        ?.contentTypes;
    const results = content_types?.results;
    if (!Array.isArray(results)) return [];
    return results
        .filter((r) => r.detected && r.contentTypeId)
        .map((r) => String(r.contentTypeId));
}

function update_row(
    deps: BulkImportOrchestratorDeps,
    row: BulkImportPreparedRow,
    patch: Partial<BulkImportPreparedRow>
): BulkImportPreparedRow {
    const next = { ...row, ...patch };
    deps.on_row_updated(next);
    return next;
}

export async function run_bulk_url_capture_phase(
    deps: BulkImportOrchestratorDeps,
    rows: BulkImportPreparedRow[],
    sample_category_id: string
): Promise<BulkImportPreparedRow[]> {
    const state = deps.getState();
    const audit_id = state?.auditId ? String(state.auditId) : null;
    if (!audit_id) {
        throw new Error('bulk_url_import_no_audit');
    }

    const output: BulkImportPreparedRow[] = [];
    for (const source_row of rows) {
        if (deps.signal?.aborted) break;
        let row = update_row(deps, source_row, { status: 'fetching', error_message: null });
        const sample_id = deps.generate_uuid();
        const capture_id = deps.generate_uuid();

        try {
            const response: AuditSnapshotCaptureResponse = await start_audit_snapshot_capture(
                audit_id,
                {
                    captureId: capture_id,
                    sampleId: sample_id,
                    url: row.url,
                    attachScreenshotToSample: true,
                },
                deps.signal
            );

            const page_title =
                response.pageTitle.outcome === 'success' ? (response.pageTitle.value || null) : null;
            row = update_row(deps, row, {
                status: page_title ? 'title_ready' : 'needs_action',
                page_title,
                sample_id,
                capture_id,
            });

            const screenshot_filename =
                response.screenshot.outcome === 'success' ? (response.screenshot.filename || null) : null;
            row = update_row(deps, row, {
                status: screenshot_filename ? 'screenshot_ready' : row.status,
                screenshot_filename,
            });

            const classification = classify_sample_page_type({
                final_url: row.url,
                page_title: page_title || undefined,
                rule_file_content: state?.ruleFileContent,
            });

            row = update_row(deps, row, {
                suggested_sample_type_id: classification.suggestedTypeId,
                suggested_sample_type_confidence: classification.confidence,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            row = update_row(deps, row, { status: 'failed', error_message: message });
        }

        output.push(row);
        void sample_category_id;
    }

    return output;
}

export async function save_bulk_import_rows(
    deps: BulkImportOrchestratorDeps,
    rows: BulkImportPreparedRow[],
    sample_category_id: string
): Promise<BulkImportPreparedRow[]> {
    const state = deps.getState();
    const audit_id = state?.auditId ? String(state.auditId) : null;
    if (!audit_id) {
        throw new Error('bulk_url_import_no_audit');
    }

    await sync_to_server_now(
        deps.getState as () => { auditId?: string } | null,
        deps.dispatch as (action: unknown) => void
    );
    const saved_rows: BulkImportPreparedRow[] = [];

    for (const source_row of rows) {
        if (!source_row.include_in_save || source_row.status === 'failed') {
            saved_rows.push(source_row);
            continue;
        }
        if (!source_row.sample_id) continue;

        const sample_payload = {
            id: source_row.sample_id,
            description: source_row.page_title || source_row.url,
            url: source_row.url,
            sampleCategory: sample_category_id,
            sampleType: source_row.suggested_sample_type_id || '',
            selectedContentTypes: [...source_row.selected_content_type_ids],
            attachedMediaFilenames: source_row.screenshot_filename
                ? [source_row.screenshot_filename]
                : [],
            contentTypeDetectionCaptureId: source_row.capture_id || undefined,
            suggestedSampleTypeId: source_row.suggested_sample_type_id || undefined,
            suggestedSampleTypeConfidence: source_row.suggested_sample_type_confidence,
        };

        deps.dispatch({
            type: deps.StoreActionTypes.ADD_SAMPLE,
            payload: sample_payload,
        });

        let row = update_row(deps, source_row, { status: 'sidrapport_queued' });
        await queue_sidrapport_after_sample_save(
            {
                getState: deps.getState,
                dispatch: deps.dispatch as (action: unknown) => void,
            },
            {
                sampleId: source_row.sample_id,
                url: source_row.url,
                sampleCategory: sample_category_id,
                attachedMediaFilenames: sample_payload.attachedMediaFilenames,
            }
        );

        if (row.capture_id) {
            const ready = await deps.wait_for_snapshot_ready(audit_id, row.capture_id, 120000);
            if (ready) {
                const summary = await fetch_snapshot_analysis_summary(audit_id, row.capture_id);
                const detected = extract_detected_content_type_ids(summary);
                const refined_type_id =
                    summary.pageTypeClassification?.suggestedTypeId || row.suggested_sample_type_id;
                row = update_row(deps, row, {
                    status: 'sidrapport_ready',
                    detected_content_type_ids: detected,
                    suggested_sample_type_id: refined_type_id,
                    suggested_sample_type_confidence:
                        summary.pageTypeClassification?.confidence ??
                        row.suggested_sample_type_confidence,
                    selected_content_type_ids:
                        row.selected_content_type_ids.length > 0
                            ? row.selected_content_type_ids
                            : detected,
                });
            } else {
                row = update_row(deps, row, { status: 'needs_action' });
            }
        }

        row = update_row(deps, row, { status: 'saved' });
        saved_rows.push(row);
    }

    return saved_rows;
}

export async function run_full_bulk_url_import(
    deps: BulkImportOrchestratorDeps,
    rows: BulkImportPreparedRow[],
    sample_category_id: string
): Promise<BulkImportPreparedRow[]> {
    const output: BulkImportPreparedRow[] = [];
    for (const source_row of rows) {
        if (deps.signal?.aborted) break;
        const [captured] = await run_bulk_url_capture_phase(deps, [source_row], sample_category_id);
        const [saved] = await save_bulk_import_rows(deps, [captured], sample_category_id);
        output.push(saved);
    }
    return output;
}

export async function list_ready_snapshot_entries(
    audit_id: string
): Promise<Array<{ sampleId: string; captureId: string }>> {
    const list = await list_audit_snapshots(audit_id);
    const entries: Array<{ sampleId: string; captureId: string }> = [];
    for (const item of list.items) {
        if (item.currentReady?.snapshotId) {
            entries.push({
                sampleId: item.sampleId,
                captureId: item.currentReady.snapshotId,
            });
        }
    }
    return entries;
}
