/**
 * @fileoverview Skapar återkommande granskningsdelar efter bulkimport av URL:er.
 */
import { analyze_recurring_content } from '../api/audit_snapshot_api.js';
import { sync_to_server_now } from './server_sync.js';
import { list_ready_snapshot_entries } from './bulk_sample_url_import_orchestrator.js';
import { log_import_step } from './bulk_sample_url_import_orchestrator_log.js';
import type { BulkImportLogDeps } from './bulk_sample_url_import_orchestrator_log.js';
import {
    build_recurring_sample_payload,
    recurring_sample_exists,
    resolve_recurring_sample_category,
} from './recurring_sample_resolver.js';
import { resolve_recurring_sample_content_type_ids } from './recurring_sample_content_types.js';
import { resolve_recurring_sample_screenshot_filename } from './recurring_sample_screenshot.js';

export type BulkImportCreatedItem = {
    kind: 'url_sample' | 'recurring_sample';
    label: string;
    category_label: string;
};

export type BulkRecurringImportDeps = BulkImportLogDeps & {
    getState: () => {
        auditId?: string | null;
        samples?: Array<Record<string, unknown>>;
        ruleFileContent?: { metadata?: unknown };
    } | null;
    dispatch: (action: { type: string; payload?: unknown }) => void;
    StoreActionTypes: { ADD_SAMPLE: string };
    generate_uuid: () => string;
    t: (key: string, params?: Record<string, unknown>) => string;
};

const RECURRING_LABEL_KEYS: Record<string, string> = {
    header: 'recurring_content_type_header',
    menu: 'recurring_content_type_menu',
    footer: 'recurring_content_type_footer',
    cookie: 'recurring_content_type_cookie',
    section_navigation: 'recurring_content_type_section_navigation',
    other_recurring: 'recurring_content_type_other',
};

function recurring_fallback_label(
    t: BulkRecurringImportDeps['t'],
    candidate_type: string
): string {
    const key = RECURRING_LABEL_KEYS[candidate_type] || RECURRING_LABEL_KEYS.other_recurring;
    return t(key);
}

export async function run_bulk_recurring_import_phase(
    deps: BulkRecurringImportDeps
): Promise<{ created: BulkImportCreatedItem[]; skipped: number }> {
    const state = deps.getState();
    const audit_id = state?.auditId ? String(state.auditId) : null;
    const metadata = state?.ruleFileContent?.metadata;
    const category = resolve_recurring_sample_category(metadata);
    const category_label = String(category?.text ?? '').trim();

    if (!audit_id || !category) {
        log_import_step(deps, 'bulk_url_import_log_recurring_skip', {
            reason: !audit_id ? 'ingen granskning' : 'saknar kategori i regelfilen',
        });
        return { created: [], skipped: 0 };
    }

    const category_id = String(category.id ?? '').trim();
    const entries = await list_ready_snapshot_entries(audit_id);
    if (entries.length < 2) {
        log_import_step(deps, 'bulk_url_import_log_recurring_skip', {
            reason: 'för få klara sidrapporter',
            count: entries.length,
        });
        return { created: [], skipped: 0 };
    }

    log_import_step(deps, 'bulk_url_import_log_recurring_start', { count: entries.length });

    let suggestions: Array<Record<string, unknown>> = [];
    try {
        const response = await analyze_recurring_content(audit_id, entries);
        suggestions = response.suggestions as Array<Record<string, unknown>>;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log_import_step(deps, 'bulk_url_import_log_recurring_failed', { error: message }, { level: 'error' });
        return { created: [], skipped: 0 };
    }

    if (suggestions.length === 0) {
        log_import_step(deps, 'bulk_url_import_log_recurring_none');
        return { created: [], skipped: 0 };
    }

    const created: BulkImportCreatedItem[] = [];
    let skipped = 0;
    const samples = state?.samples ?? [];

    for (const raw of suggestions) {
        const suggestion = {
            candidateType: String(raw.candidateType ?? ''),
            structureFingerprint: String(raw.structureFingerprint ?? ''),
            rootIdentity: String(raw.rootIdentity ?? ''),
            evidenceRefs: raw.evidenceRefs as { sampleIds?: string[]; captureIds?: string[] } | undefined,
        };

        if (recurring_sample_exists(samples, category_id, suggestion)) {
            skipped += 1;
            log_import_step(deps, 'bulk_url_import_log_recurring_skip_item', {
                type: recurring_fallback_label(deps.t, suggestion.candidateType),
            });
            continue;
        }

        const payload = build_recurring_sample_payload(
            metadata,
            suggestion,
            recurring_fallback_label(deps.t, suggestion.candidateType)
        );
        if (!payload) {
            skipped += 1;
            continue;
        }

        const selected_content_types = await resolve_recurring_sample_content_type_ids(
            audit_id,
            metadata,
            suggestion.evidenceRefs?.captureIds
        );

        const screenshot_filename = await resolve_recurring_sample_screenshot_filename(audit_id, {
            label: payload.description,
            candidateType: suggestion.candidateType,
            structureFingerprint: suggestion.structureFingerprint,
            rootIdentity: String(raw.rootIdentity ?? ''),
            captureIds: suggestion.evidenceRefs?.captureIds,
        });

        const sample_id = deps.generate_uuid();
        deps.dispatch({
            type: deps.StoreActionTypes.ADD_SAMPLE,
            payload: {
                id: sample_id,
                description: payload.description,
                url: '',
                sampleCategory: payload.sampleCategory,
                sampleType: payload.sampleType,
                selectedContentTypes: selected_content_types,
                attachedMediaFilenames: screenshot_filename ? [screenshot_filename] : [],
                requirementResults: {},
                recurringComponentType: payload.recurringComponentType,
                recurringStructureFingerprint: payload.recurringStructureFingerprint,
                recurringEvidenceRefs: payload.recurringEvidenceRefs,
                skip_render: true,
            },
        });

        samples.push({
            id: sample_id,
            sampleCategory: payload.sampleCategory,
            sampleType: payload.sampleType,
            recurringComponentType: payload.recurringComponentType,
            recurringStructureFingerprint: payload.recurringStructureFingerprint,
        });

        created.push({
            kind: 'recurring_sample',
            label: payload.description,
            category_label,
        });

        log_import_step(deps, 'bulk_url_import_log_recurring_created', {
            type: payload.description,
            screenshot: screenshot_filename ? 'ja' : 'nej',
        });
    }

    if (created.length > 0) {
        log_import_step(deps, 'bulk_url_import_log_recurring_sync');
        await sync_to_server_now(deps.getState as () => { auditId?: string } | null, deps.dispatch);
    }

    log_import_step(deps, 'bulk_url_import_log_recurring_done', {
        created: created.length,
        skipped,
    });

    return { created, skipped };
}
