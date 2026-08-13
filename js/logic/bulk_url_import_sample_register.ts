/**
 * @fileoverview Registrerar granskningsdel på servern före snapshot-capture vid bulkimport.
 */
import { sync_to_server_now as default_sync_to_server_now } from './server_sync.js';

export type BulkImportRegisterRow = {
    row_id: string;
    url: string;
    sample_id: string | null;
};

export type BulkImportLogFn = (
    message_key: string,
    params?: Record<string, unknown>,
    meta?: { level?: 'info' | 'warn' | 'error'; row_id?: string; url?: string }
) => void;

export type BulkImportSampleRegisterDeps = {
    getState: () => {
        auditId?: string | null;
        samples?: Array<{ id?: string }>;
    } | null;
    dispatch: (action: { type: string; payload?: unknown }) => void;
    StoreActionTypes: { ADD_SAMPLE: string; DELETE_SAMPLE?: string };
    generate_uuid: () => string;
    log_import_step?: BulkImportLogFn;
    sync_to_server_now?: (
        get_state_fn: () => { auditId?: string } | null,
        dispatch_fn: (action: unknown) => void
    ) => Promise<void>;
};

type RegisterContext = { index: number; total: number };

function sample_exists_in_state(
    getState: BulkImportSampleRegisterDeps['getState'],
    sample_id: string
): boolean {
    const samples = getState()?.samples;
    if (!Array.isArray(samples)) return false;
    return samples.some((entry) => String(entry.id ?? '') === String(sample_id));
}

export async function ensure_bulk_import_sample_on_server(
    deps: BulkImportSampleRegisterDeps,
    row: BulkImportRegisterRow,
    sample_category_id: string,
    row_context?: RegisterContext
): Promise<BulkImportRegisterRow> {
    const audit_id = deps.getState()?.auditId ? String(deps.getState()!.auditId) : null;
    if (!audit_id) {
        throw new Error('bulk_url_import_no_audit');
    }

    const existing_id = row.sample_id ? String(row.sample_id) : '';
    if (existing_id && sample_exists_in_state(deps.getState, existing_id)) {
        return row;
    }

    const sample_id = deps.generate_uuid();
    deps.dispatch({
        type: deps.StoreActionTypes.ADD_SAMPLE,
        payload: {
            id: sample_id,
            description: row.url,
            url: row.url,
            sampleCategory: sample_category_id,
            sampleType: '',
            selectedContentTypes: [],
            attachedMediaFilenames: [],
            requirementResults: {},
            skip_render: true,
        },
    });

    deps.log_import_step?.('bulk_url_import_log_register_sample', {
        index: row_context?.index ?? 1,
        total: row_context?.total ?? 1,
    }, { row_id: row.row_id, url: row.url });

    const sync_now = deps.sync_to_server_now ?? default_sync_to_server_now;
    await sync_now(
        deps.getState as () => { auditId?: string } | null,
        deps.dispatch as (action: unknown) => void
    );

    return { ...row, sample_id };
}

export async function remove_bulk_import_stub_sample(
    deps: BulkImportSampleRegisterDeps,
    sample_id: string | null | undefined
): Promise<void> {
    const id = String(sample_id ?? '').trim();
    if (!id || !deps.StoreActionTypes.DELETE_SAMPLE) return;
    if (!sample_exists_in_state(deps.getState, id)) return;

    deps.dispatch({
        type: deps.StoreActionTypes.DELETE_SAMPLE,
        payload: { sampleId: id, skip_render: true },
    });

    try {
        const sync_now = deps.sync_to_server_now ?? default_sync_to_server_now;
        await sync_now(
            deps.getState as () => { auditId?: string } | null,
            deps.dispatch as (action: unknown) => void
        );
    } catch {
        // Bästa försök — stubben tas bort lokalt även om synk misslyckas
    }
}
