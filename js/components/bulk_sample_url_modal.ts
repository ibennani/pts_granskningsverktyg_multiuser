/**
 * @fileoverview Tillgänglig modal för att skapa URL-baserade granskningsdelar i bulk.
 * Använder samma samplemodell och samma sidrapportflöde som manuellt skapade delar.
 */
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import {
    fetch_audit_url_page_title,
    detect_content_types_from_url,
} from '../api/audit_media_api.js';
import { resolve_content_types, resolve_sample_vocab } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { classify_page_type, resolve_sample_type_id_for_classification } from '../../shared/sample/page_type_classifier.js';
import { parse_bulk_sample_urls, type BulkSampleUrlEntry } from '../logic/bulk_sample_url_input.js';
import { sync_to_server_now } from '../logic/server_sync.js';
import { start_sidrapport_retake_for_sample } from '../logic/audit_sidrapport_retake.js';

type BulkHost = {
    getState: () => any;
    dispatch: (action: any) => void;
    StoreActionTypes: Record<string, string>;
    Helpers: any;
    Translation: { t: (key: string, params?: Record<string, unknown>) => string };
    NotificationComponent?: { show_global_message?: (message: string, type?: string) => void };
    on_complete?: () => void;
};

type RowState = {
    entry: BulkSampleUrlEntry;
    status: 'waiting' | 'fetching' | 'created' | 'report_queued' | 'failed';
    message: string;
    sampleId?: string;
};

function t_fallback(host: BulkHost, key: string, fallback: string, params?: Record<string, unknown>): string {
    const value = host.Translation?.t?.(key, params);
    return value && value !== key && value !== `**${key}**` ? value : fallback;
}

function find_url_sample_category(state: any): any | null {
    const categories = resolve_sample_vocab(state?.ruleFileContent?.metadata).sampleCategories || [];
    return categories.find((category: any) => category?.hasUrl === true) || null;
}

function collect_content_type_ids(state: any): { defaults: string[]; all: string[] } {
    const groups = resolve_content_types(state?.ruleFileContent?.metadata) as Array<{
        types?: Array<{ id?: string; defaultSelected?: boolean }>;
    }>;
    const defaults: string[] = [];
    const all: string[] = [];
    for (const group of groups) {
        for (const child of group.types || []) {
            const id = String(child?.id || '').trim();
            if (!id) continue;
            all.push(id);
            if (child?.defaultSelected === true) defaults.push(id);
        }
    }
    return { defaults: [...new Set(defaults)], all: [...new Set(all)] };
}

function create_sample_id(host: BulkHost): string {
    if (typeof host.Helpers?.generate_uuid_v4 === 'function') return host.Helpers.generate_uuid_v4();
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function fetch_title(audit_id: string, url: string): Promise<string> {
    try {
        const result = await fetch_audit_url_page_title(audit_id, url);
        return String(result?.pageTitle || '').trim();
    } catch {
        return '';
    }
}

async function detect_content_types(audit_id: string, url: string, allowed_ids: string[]): Promise<string[]> {
    if (!allowed_ids.length) return [];
    try {
        const result = await detect_content_types_from_url(audit_id, url, allowed_ids);
        return Array.isArray(result?.detectedContentTypeIds) ? result.detectedContentTypeIds : [];
    } catch {
        return [];
    }
}

function build_sample_type(category: any, url: string, title: string): {
    sampleType: string | null;
    classification: ReturnType<typeof classify_page_type>;
} {
    const classification = classify_page_type({ requestedUrl: url, finalUrl: url, pageTitle: title });
    const options = Array.isArray(category?.categories) ? category.categories : [];
    return {
        sampleType: resolve_sample_type_id_for_classification(classification, options),
        classification,
    };
}

function render_rows(list: HTMLElement, rows: RowState[]): void {
    list.innerHTML = '';
    for (const row of rows) {
        const li = document.createElement('li');
        li.className = `bulk-sample-url-row bulk-sample-url-row--${row.status}`;
        const url = document.createElement('span');
        url.className = 'bulk-sample-url-row-url';
        url.textContent = row.entry.normalizedUrl || row.entry.input;
        const status = document.createElement('span');
        status.className = 'bulk-sample-url-row-status';
        status.textContent = row.message;
        li.append(url, document.createTextNode(' – '), status);
        list.appendChild(li);
    }
}

export function show_bulk_sample_url_modal(host: BulkHost, trigger: HTMLElement | null): void {
    const ModalComponent = app_runtime_refs.modal_component as any;
    if (!ModalComponent?.show || !host?.Helpers?.create_element) return;

    ModalComponent.show(
        {
            h1_text: t_fallback(host, 'bulk_sample_urls_title', 'Skapa granskningsdelar från URL-lista'),
            message_text: t_fallback(
                host,
                'bulk_sample_urls_intro',
                'Klistra in en webbadress per rad. Leffe skapar en granskningsdel per giltig webbadress och köar en sidrapport.'
            ),
        },
        (container: HTMLElement, modal: { close: (focus?: HTMLElement | null) => void }) => {
            const textarea_id = `bulk-sample-urls-${Math.random().toString(36).slice(2, 8)}`;
            const group = host.Helpers.create_element('div', { class_name: 'form-group' });
            const label = host.Helpers.create_element('label', {
                attributes: { for: textarea_id },
                text_content: t_fallback(host, 'bulk_sample_urls_label', 'Webbadresser'),
            });
            const hint_id = `${textarea_id}-hint`;
            const hint = host.Helpers.create_element('p', {
                id: hint_id,
                class_name: 'field-hint',
                text_content: t_fallback(host, 'bulk_sample_urls_help', 'Ange en webbadress per rad. Tomma rader ignoreras och dubbletter skapas bara en gång.'),
            });
            const textarea = host.Helpers.create_element('textarea', {
                id: textarea_id,
                class_name: 'form-control bulk-sample-url-textarea',
                attributes: {
                    rows: '10',
                    'aria-describedby': hint_id,
                    'data-skip-markdown-toolbar': 'true',
                },
            }) as HTMLTextAreaElement;
            group.append(label, hint, textarea);
            container.appendChild(group);

            const validation = host.Helpers.create_element('div', {
                class_name: 'bulk-sample-url-validation',
                attributes: { role: 'status', 'aria-live': 'polite' },
            });
            container.appendChild(validation);

            const row_heading = host.Helpers.create_element('h2', {
                class_name: 'bulk-sample-url-progress-heading',
                text_content: t_fallback(host, 'bulk_sample_urls_progress_heading', 'Status per webbadress'),
            });
            row_heading.hidden = true;
            const row_list = host.Helpers.create_element('ul', { class_name: 'bulk-sample-url-progress-list' });
            container.append(row_heading, row_list);

            const actions = host.Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
            const run = host.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                attributes: { type: 'button' },
                text_content: t_fallback(host, 'bulk_sample_urls_run', 'Skapa granskningsdelar'),
            }) as HTMLButtonElement;
            const close = host.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                text_content: t_fallback(host, 'close', 'Stäng'),
            }) as HTMLButtonElement;
            close.addEventListener('click', () => modal.close(trigger));
            actions.append(run, close);
            container.appendChild(actions);

            run.addEventListener('click', async () => {
                const parsed = parse_bulk_sample_urls(textarea.value || '');
                const invalid = parsed.filter((entry) => entry.status === 'invalid');
                const duplicate = parsed.filter((entry) => entry.status === 'duplicate');
                const valid = parsed.filter((entry) => entry.status === 'valid' && entry.normalizedUrl);
                if (valid.length === 0) {
                    validation.textContent = invalid.length
                        ? t_fallback(host, 'bulk_sample_urls_no_valid', 'Inga giltiga webbadresser kunde hittas.')
                        : t_fallback(host, 'bulk_sample_urls_empty', 'Ange minst en webbadress.');
                    textarea.focus();
                    return;
                }

                validation.textContent = [
                    `${valid.length} giltiga`,
                    invalid.length ? `${invalid.length} ogiltiga` : '',
                    duplicate.length ? `${duplicate.length} dubbletter` : '',
                ].filter(Boolean).join(', ') + '.';

                const state = host.getState?.();
                const category = find_url_sample_category(state);
                const audit_id = String(state?.auditId || '').trim();
                if (!category || !audit_id) {
                    validation.textContent = t_fallback(
                        host,
                        'bulk_sample_urls_missing_context',
                        'Det går inte att skapa URL-baserade granskningsdelar eftersom granskningskategori eller gransknings-ID saknas.'
                    );
                    return;
                }

                const rows: RowState[] = valid.map((entry) => ({
                    entry,
                    status: 'waiting',
                    message: t_fallback(host, 'bulk_sample_urls_status_waiting', 'Väntar'),
                }));
                row_heading.hidden = false;
                render_rows(row_list, rows);
                run.disabled = true;
                textarea.disabled = true;

                const content_types = collect_content_type_ids(state);
                const created: Array<{ id: string; url: string }> = [];

                for (const row of rows) {
                    const url = row.entry.normalizedUrl!;
                    row.status = 'fetching';
                    row.message = t_fallback(host, 'bulk_sample_urls_status_fetching', 'Hämtar sidtitel och analyserar innehåll');
                    render_rows(row_list, rows);
                    const title = await fetch_title(audit_id, url);
                    const detected = await detect_content_types(audit_id, url, content_types.all);
                    const classified = build_sample_type(category, url, title);
                    const id = create_sample_id(host);
                    const sample = {
                        id,
                        sampleCategory: String(category.id || ''),
                        sampleType: classified.sampleType,
                        description: title || url,
                        url,
                        selectedContentTypes: [...new Set([...content_types.defaults, ...detected])],
                        attachedMediaFilenames: [],
                        urlAutoScreenshotFilename: null,
                        requirementResults: {},
                        autoCreation: {
                            source: 'bulk-url-list',
                            contentTypeDetection: {
                                detectedContentTypeIds: detected,
                            },
                            pageTypeSuggestion: {
                                kind: classified.classification.kind,
                                score: classified.classification.score,
                                confidence: classified.classification.confidence,
                                reasons: classified.classification.reasons,
                            },
                        },
                    };
                    try {
                        host.dispatch({ type: host.StoreActionTypes.ADD_SAMPLE, payload: { ...sample, skip_render: true } });
                        row.sampleId = id;
                        row.status = 'created';
                        row.message = title
                            ? t_fallback(host, 'bulk_sample_urls_status_created_title', `Skapad: ${title}`)
                            : t_fallback(host, 'bulk_sample_urls_status_created', 'Granskningsdel skapad');
                        created.push({ id, url });
                    } catch {
                        row.status = 'failed';
                        row.message = t_fallback(host, 'bulk_sample_urls_status_failed', 'Kunde inte skapa granskningsdelen');
                    }
                    render_rows(row_list, rows);
                }

                try {
                    await sync_to_server_now(host.getState, host.dispatch);
                } catch {
                    // Delarna finns fortfarande i lokalt state. Sidrapporterna markeras som misslyckade nedan.
                }

                for (const item of created) {
                    const row = rows.find((candidate) => candidate.sampleId === item.id);
                    if (!row) continue;
                    try {
                        await start_sidrapport_retake_for_sample(audit_id, {
                            id: item.id,
                            url: item.url,
                            attachedMediaFilenames: [],
                        });
                        row.status = 'report_queued';
                        row.message = t_fallback(host, 'bulk_sample_urls_status_report_queued', 'Sidrapport köad');
                    } catch {
                        row.status = 'failed';
                        row.message = t_fallback(host, 'bulk_sample_urls_status_report_failed', 'Granskningsdelen skapades men sidrapporten kunde inte köas');
                    }
                    render_rows(row_list, rows);
                }

                validation.textContent = t_fallback(
                    host,
                    'bulk_sample_urls_complete',
                    `${created.length} granskningsdelar skapades. Sidrapporterna fortsätter i den vanliga rapportkön.`,
                    { count: created.length }
                );
                host.on_complete?.();
                run.disabled = false;
                textarea.disabled = false;
            });

            requestAnimationFrame(() => textarea.focus());
        }
    );
}
