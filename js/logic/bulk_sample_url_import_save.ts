/**
 * @fileoverview Sparfas för bulkimport: sidrapport, innehållstyper och UPDATE_SAMPLE.
 */
import { fetch_snapshot_analysis_summary } from '../api/audit_snapshot_api.js';
import {
    build_bulk_import_sidrapport_sample_patch,
} from './bulk_import_content_types.js';
import {
    log_import_step,
    type BulkImportLogFn,
} from './bulk_sample_url_import_orchestrator_log.js';
import type {
    BulkImportOrchestratorDeps,
    BulkImportPreparedRow,
} from './bulk_sample_url_import_orchestrator.js';

type SaveRowContext = { index: number; total: number };

function update_row(
    deps: BulkImportOrchestratorDeps,
    row: BulkImportPreparedRow,
    patch: Partial<BulkImportPreparedRow>
): BulkImportPreparedRow {
    const next = { ...row, ...patch };
    deps.on_row_updated(next);
    return next;
}

function dispatch_sample_update(
    deps: BulkImportOrchestratorDeps,
    sample_id: string,
    updated: Record<string, unknown>
): void {
    deps.dispatch({
        type: deps.StoreActionTypes.UPDATE_SAMPLE,
        payload: {
            sampleId: sample_id,
            updatedSampleData: updated,
            skip_render: true,
        },
    });
}

/** Sidrapport pågår ofta längre än 2 min på testservern. */
const BULK_SIDRAPPORT_WAIT_MS = 180000;

async function wait_and_apply_sidrapport(
    deps: BulkImportOrchestratorDeps,
    row: BulkImportPreparedRow,
    sample_payload: Record<string, unknown>,
    audit_id: string,
    row_context: SaveRowContext | undefined
): Promise<BulkImportPreparedRow> {
    if (!row.capture_id) return row;

    const timeout_ms = BULK_SIDRAPPORT_WAIT_MS;
    log_import_step(deps, 'bulk_url_import_log_sidrapport_wait', {
        index: row_context?.index ?? 1,
        total: row_context?.total ?? 1,
        timeoutSec: Math.round(timeout_ms / 1000),
    }, { row_id: row.row_id, url: row.url });

    const ready = await deps.wait_for_snapshot_ready(audit_id, row.capture_id, timeout_ms);
    if (!ready) {
        log_import_step(deps, 'bulk_url_import_log_sidrapport_timeout', {
            index: row_context?.index ?? 1,
            total: row_context?.total ?? 1,
        }, { level: 'warn', row_id: row.row_id, url: row.url });
        return update_row(deps, row, { status: 'needs_action' });
    }

    log_import_step(deps, 'bulk_url_import_log_sidrapport_ready', {
        index: row_context?.index ?? 1,
        total: row_context?.total ?? 1,
    }, { row_id: row.row_id, url: row.url });

    const summary = await fetch_snapshot_analysis_summary(audit_id, row.capture_id);
    const patch = build_bulk_import_sidrapport_sample_patch(row, summary);
    log_import_step(deps, 'bulk_url_import_log_summary', {
        index: row_context?.index ?? 1,
        total: row_context?.total ?? 1,
        detectedCount: patch.detected_content_type_ids.length,
    }, { row_id: row.row_id, url: row.url });

    const next_row = update_row(deps, row, {
        status: 'sidrapport_ready',
        detected_content_type_ids: patch.detected_content_type_ids,
        suggested_sample_type_id: patch.sampleType || null,
        suggested_sample_type_confidence: patch.suggestedSampleTypeConfidence,
        selected_content_type_ids: patch.selected_content_type_ids,
    });

    dispatch_sample_update(deps, String(row.sample_id), {
        ...sample_payload,
        sampleType: patch.sampleType,
        selectedContentTypes: patch.selected_content_type_ids,
        suggestedSampleTypeId: patch.suggestedSampleTypeId,
        suggestedSampleTypeConfidence: patch.suggestedSampleTypeConfidence,
    });

    return next_row;
}

export async function save_bulk_import_rows(
    deps: BulkImportOrchestratorDeps,
    rows: BulkImportPreparedRow[],
    sample_category_id: string,
    row_context?: SaveRowContext
): Promise<BulkImportPreparedRow[]> {
    const state = deps.getState();
    const audit_id = state?.auditId ? String(state.auditId) : null;
    if (!audit_id) {
        throw new Error('bulk_url_import_no_audit');
    }

    const saved_rows: BulkImportPreparedRow[] = [];

    for (const source_row of rows) {
        if (!source_row.include_in_save || source_row.status === 'failed') {
            log_import_step(deps, 'bulk_url_import_log_save_skip', {
                index: row_context?.index ?? 1,
                total: row_context?.total ?? rows.length,
                reason: source_row.status === 'failed' ? 'hämtning misslyckades' : 'ej vald',
            }, { row_id: source_row.row_id, url: source_row.url, level: 'warn' });
            saved_rows.push(source_row);
            continue;
        }
        if (!source_row.sample_id) continue;

        log_import_step(deps, 'bulk_url_import_log_save_dispatch', {
            index: row_context?.index ?? 1,
            total: row_context?.total ?? rows.length,
        }, { row_id: source_row.row_id, url: source_row.url });

        const sample_payload: Record<string, unknown> = {
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

        dispatch_sample_update(deps, source_row.sample_id, sample_payload);

        let row = update_row(deps, source_row, { status: 'sidrapport_queued' });

        row = await wait_and_apply_sidrapport(
            deps,
            row,
            sample_payload,
            audit_id,
            row_context
        );

        row = update_row(deps, row, { status: 'saved' });
        log_import_step(deps, 'bulk_url_import_log_row_done', {
            index: row_context?.index ?? 1,
            total: row_context?.total ?? rows.length,
        }, { row_id: row.row_id, url: row.url });
        saved_rows.push(row);
    }

    return saved_rows;
}

export type { BulkImportLogFn };
