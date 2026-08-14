/**
 * @fileoverview Orkestrator för bulkimport av URL-lista via befintlig capture-kö.
 */
import {
    start_audit_snapshot_capture,
    list_audit_snapshots,
    type AuditSnapshotCaptureResponse,
} from '../api/audit_snapshot_api.js';
import { classify_sample_page_type } from '../../shared/logic/sample_page_type_classifier.js';
import {
    ensure_bulk_import_sample_on_server,
    remove_bulk_import_stub_sample,
} from './bulk_url_import_sample_register.js';
import { ensure_audit_id_for_server_sync } from './ensure_audit_id_for_server_sync.js';
import { type BulkUrlImportLogSink } from './bulk_url_import_logger.js';
import {
    log_import_step,
    outcome_label,
    type BulkImportLogFn,
} from './bulk_sample_url_import_orchestrator_log.js';
import { save_bulk_import_rows } from './bulk_sample_url_import_save.js';
import {
    run_bulk_recurring_import_phase,
    type BulkImportCreatedItem,
    type BulkRecurringImportDeps,
} from './bulk_recurring_import.js';
import { resolve_default_url_sample_category_id } from './bulk_url_import_category.js';
import { is_web_monitoring_audit } from './is_web_monitoring_audit.js';

export type { BulkImportLogFn, BulkImportCreatedItem };

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
        samples?: Array<{ id?: string }>;
    } | null;
    dispatch: (action: { type: string; payload?: unknown }) => void;
    StoreActionTypes: {
        ADD_SAMPLE: string;
        UPDATE_SAMPLE: string;
        DELETE_SAMPLE?: string;
    };
    generate_uuid: () => string;
    add_protocol_if_missing?: (url: string) => string;
    on_row_updated: (row: BulkImportPreparedRow) => void;
    on_progress_message?: (message: string) => void;
    log_import_step?: BulkImportLogFn;
    import_log_sink?: BulkUrlImportLogSink;
    wait_for_snapshot_ready: (
        audit_id: string,
        capture_id: string,
        timeout_ms: number
    ) => Promise<boolean>;
    signal?: AbortSignal;
    t?: (key: string, params?: Record<string, unknown>) => string;
};

export type BulkImportRunResult = {
    rows: BulkImportPreparedRow[];
    created_items: BulkImportCreatedItem[];
    recurring_skipped: number;
};

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
    sample_category_id: string,
    row_context?: { index: number; total: number }
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
        const capture_id = deps.generate_uuid();
        let registered_sample_id: string | null = null;

        log_import_step(deps, 'bulk_url_import_log_capture_start', {
            index: row_context?.index ?? 1,
            total: row_context?.total ?? rows.length,
        }, { row_id: source_row.row_id, url: row.url });

        try {
            row = {
                ...row,
                ...(await ensure_bulk_import_sample_on_server(
                    deps,
                    row,
                    sample_category_id,
                    row_context
                )),
            };
            registered_sample_id = row.sample_id;
            if (!registered_sample_id) {
                throw new Error('bulk_url_import_register_failed');
            }

            const response: AuditSnapshotCaptureResponse = await start_audit_snapshot_capture(
                audit_id,
                {
                    captureId: capture_id,
                    sampleId: registered_sample_id,
                    url: row.url,
                    attachScreenshotToSample: true,
                },
                deps.signal
            );

            const page_title =
                response.pageTitle.outcome === 'success' ? (response.pageTitle.value || null) : null;
            log_import_step(deps, 'bulk_url_import_log_capture_title', {
                index: row_context?.index ?? 1,
                total: row_context?.total ?? rows.length,
                outcome: outcome_label(page_title ? 'success' : 'missing'),
                title: page_title || '—',
            }, { row_id: row.row_id, url: row.url });

            row = update_row(deps, row, {
                status: page_title ? 'title_ready' : 'needs_action',
                page_title,
                capture_id,
            });

            const screenshot_filename =
                response.screenshot.outcome === 'success' ? (response.screenshot.filename || null) : null;
            log_import_step(deps, 'bulk_url_import_log_capture_screenshot', {
                index: row_context?.index ?? 1,
                total: row_context?.total ?? rows.length,
                outcome: outcome_label(
                    response.screenshot.outcome === 'success' ? 'success' : 'failed'
                ),
            }, { row_id: row.row_id, url: row.url });

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
            log_import_step(deps, 'bulk_url_import_log_capture_classify', {
                index: row_context?.index ?? 1,
                total: row_context?.total ?? rows.length,
                typeId: classification.suggestedTypeId || '—',
                confidence: Math.round(classification.confidence * 100),
            }, { row_id: row.row_id, url: row.url });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log_import_step(deps, 'bulk_url_import_log_capture_failed', {
                index: row_context?.index ?? 1,
                total: row_context?.total ?? rows.length,
                error: message,
            }, { level: 'error', row_id: row.row_id, url: row.url });
            if (registered_sample_id) {
                await remove_bulk_import_stub_sample(deps, registered_sample_id);
            }
            row = update_row(deps, row, { status: 'failed', error_message: message, sample_id: null });
        }

        output.push(row);
        void sample_category_id;
    }

    return output;
}

export async function run_full_bulk_url_import(
    deps: BulkImportOrchestratorDeps,
    rows: BulkImportPreparedRow[],
    sample_category_id: string
): Promise<BulkImportRunResult> {
    const state = deps.getState();
    if (!is_web_monitoring_audit(state?.ruleFileContent)) {
        throw new Error('web_monitoring_only_feature_unavailable');
    }

    log_import_step(deps, 'bulk_url_import_log_batch_start', { count: rows.length });

    const audit_id = await ensure_audit_id_for_server_sync(deps.getState, deps.dispatch);
    if (!audit_id) {
        throw new Error('bulk_url_import_no_audit');
    }
    log_import_step(deps, 'bulk_url_import_log_batch_audit', { auditId: audit_id });

    const metadata = (state?.ruleFileContent as { metadata?: unknown } | undefined)?.metadata;
    const url_category = resolve_default_url_sample_category_id(metadata);
    const url_category_label = (() => {
        const vocab = metadata as { samples?: { sampleCategories?: Array<{ id?: string; text?: string }> } } | undefined;
        const match = vocab?.samples?.sampleCategories?.find((entry) => String(entry.id) === String(url_category));
        return String(match?.text ?? 'Webbsida').trim();
    })();

    const output: BulkImportPreparedRow[] = [];
    const created_items: BulkImportCreatedItem[] = [];
    const total = rows.length;
    let index = 0;
    for (const source_row of rows) {
        if (deps.signal?.aborted) break;
        index += 1;
        log_import_step(deps, 'bulk_url_import_log_row_start', {
            index,
            total,
            url: source_row.url,
        }, { row_id: source_row.row_id, url: source_row.url });

        const row_context = { index, total };
        const [captured] = await run_bulk_url_capture_phase(
            deps,
            [source_row],
            sample_category_id,
            row_context
        );
        if (captured.status === 'failed') {
            log_import_step(deps, 'bulk_url_import_log_row_failed', { index, total }, {
                level: 'error',
                row_id: captured.row_id,
                url: captured.url,
            });
            output.push(captured);
            continue;
        }
        const [saved] = await save_bulk_import_rows(deps, [captured], sample_category_id, row_context);
        output.push(saved);
        if (saved.status === 'saved') {
            created_items.push({
                kind: 'url_sample',
                label: saved.page_title || saved.url,
                category_label: url_category_label,
            });
        }
    }

    const failed = output.filter((row) => row.status === 'failed').length;
    const success = output.length - failed;
    log_import_step(deps, 'bulk_url_import_log_batch_done', { success, failed });

    let recurring_skipped = 0;
    if (deps.t && output.filter((row) => row.status === 'saved').length >= 2) {
        const recurring = await run_bulk_recurring_import_phase({
            getState: deps.getState as BulkRecurringImportDeps['getState'],
            dispatch: deps.dispatch,
            StoreActionTypes: deps.StoreActionTypes,
            generate_uuid: deps.generate_uuid,
            t: deps.t,
            log_import_step: deps.log_import_step,
            import_log_sink: deps.import_log_sink,
        });
        created_items.push(...recurring.created);
        recurring_skipped = recurring.skipped;
    }

    return { rows: output, created_items, recurring_skipped };
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
