/**
 * @fileoverview Loggstege för bulkimport-orkestratorn.
 */
import { emit_bulk_url_import_log, type BulkUrlImportLogSink } from './bulk_url_import_logger.js';

export type BulkImportLogFn = (
    message_key: string,
    params?: Record<string, unknown>,
    meta?: { level?: 'info' | 'warn' | 'error'; row_id?: string; url?: string }
) => void;

export type BulkImportLogDeps = {
    log_import_step?: BulkImportLogFn;
    import_log_sink?: BulkUrlImportLogSink;
};

export function outcome_label(outcome: 'success' | 'failed' | 'missing'): string {
    if (outcome === 'success') return 'OK';
    if (outcome === 'failed') return 'misslyckades';
    return 'saknas';
}

export function log_import_step(
    deps: BulkImportLogDeps,
    message_key: string,
    params?: Record<string, unknown>,
    meta?: { level?: 'info' | 'warn' | 'error'; row_id?: string; url?: string }
): void {
    if (deps.log_import_step) {
        deps.log_import_step(message_key, params, meta);
        return;
    }
    if (deps.import_log_sink) {
        emit_bulk_url_import_log(deps.import_log_sink, message_key, {
            level: meta?.level ?? 'info',
            row_id: meta?.row_id,
            url: meta?.url,
        });
    }
}
