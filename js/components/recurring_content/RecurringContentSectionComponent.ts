/**
 * @fileoverview Sektion för återkommande innehåll i granskningsdelshantering.
 */
import './recurring_content_section_component.css';
import { analyze_recurring_content } from '../../api/audit_snapshot_api.js';
import { list_ready_snapshot_entries } from '../../logic/bulk_sample_url_import_orchestrator.js';
import {
    build_recurring_sample_payload,
    recurring_sample_exists,
    resolve_recurring_sample_category_id,
} from '../../logic/recurring_sample_resolver.js';

type RecurringDeps = {
    getState: () => {
        auditId?: string | null;
        samples?: Array<Record<string, unknown>>;
        ruleFileContent?: unknown;
    };
    dispatch: (action: { type: string; payload?: unknown }) => void;
    StoreActionTypes: { ADD_SAMPLE: string };
    Translation: { t: (key: string, params?: Record<string, unknown>) => string };
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        generate_uuid_v4: () => string;
    };
};

const RECURRING_LABEL_KEYS: Record<string, string> = {
    header: 'recurring_content_type_header',
    menu: 'recurring_content_type_menu',
    footer: 'recurring_content_type_footer',
    cookie: 'recurring_content_type_cookie',
    section_navigation: 'recurring_content_type_section_navigation',
    other_recurring: 'recurring_content_type_other',
};

export class RecurringContentSectionComponent {
    root: HTMLElement | null = null;
    deps: RecurringDeps | null = null;
    suggestions: Array<Record<string, unknown>> = [];
    loading = false;
    auto_load_started = false;

    init({ root, deps }: { root: HTMLElement; deps: RecurringDeps }) {
        this.root = root;
        this.deps = deps;
    }

    destroy() {
        this.root = null;
        this.deps = null;
        this.suggestions = [];
        this.auto_load_started = false;
    }

    count_url_samples(): number {
        if (!this.deps) return 0;
        const samples = this.deps.getState().samples;
        if (!Array.isArray(samples)) return 0;
        return samples.filter((sample) => String(sample.url ?? '').trim()).length;
    }

    maybe_auto_load_suggestions() {
        if (this.auto_load_started || this.loading || !this.deps) return;
        if (this.count_url_samples() < 2) return;
        this.auto_load_started = true;
        void this.load_suggestions();
    }

    async load_suggestions() {
        if (!this.deps) return;
        const audit_id = this.deps.getState().auditId ? String(this.deps.getState().auditId) : null;
        if (!audit_id) return;
        this.loading = true;
        this.render();
        try {
            const entries = await list_ready_snapshot_entries(audit_id);
            if (entries.length < 2) {
                this.suggestions = [];
                return;
            }
            const response = await analyze_recurring_content(audit_id, entries);
            this.suggestions = response.suggestions;
        } catch {
            this.suggestions = [];
        } finally {
            this.loading = false;
            this.render();
        }
    }

    handle_create_sample(suggestion: Record<string, unknown>) {
        if (!this.deps) return;
        const t = this.deps.Translation.t;
        const metadata = this.deps.getState().ruleFileContent as { metadata?: unknown } | undefined;
        const category_id = resolve_recurring_sample_category_id(metadata?.metadata);
        if (!category_id) return;

        const suggestion_like = {
            candidateType: String(suggestion.candidateType || ''),
            structureFingerprint: String(suggestion.structureFingerprint || ''),
            evidenceRefs: suggestion.evidenceRefs as { sampleIds?: string[]; captureIds?: string[] } | undefined,
        };

        if (recurring_sample_exists(this.deps.getState().samples, category_id, suggestion_like)) {
            return;
        }

        const type_key = RECURRING_LABEL_KEYS[suggestion_like.candidateType] || 'recurring_content_type_other';
        const payload = build_recurring_sample_payload(
            metadata?.metadata,
            suggestion_like,
            t(type_key)
        );
        if (!payload) return;

        const sample_id = this.deps.Helpers.generate_uuid_v4();
        this.deps.dispatch({
            type: this.deps.StoreActionTypes.ADD_SAMPLE,
            payload: {
                id: sample_id,
                description: payload.description,
                url: '',
                sampleCategory: payload.sampleCategory,
                sampleType: payload.sampleType,
                selectedContentTypes: payload.selectedContentTypes,
                attachedMediaFilenames: [],
                requirementResults: {},
                recurringComponentType: payload.recurringComponentType,
                recurringStructureFingerprint: payload.recurringStructureFingerprint,
                recurringEvidenceRefs: payload.recurringEvidenceRefs,
            },
        });
        this.suggestions = this.suggestions.filter(
            (entry) => String(entry.structureFingerprint ?? '') !== suggestion_like.structureFingerprint
        );
        this.render();
    }

    render() {
        if (!this.root || !this.deps) return;
        this.maybe_auto_load_suggestions();
        const t = this.deps.Translation.t;
        this.root.innerHTML = '';

        const section = this.deps.Helpers.create_element('section', {
            class_name: 'recurring-content-section',
        });
        section.appendChild(this.deps.Helpers.create_element('h2', {
            text_content: t('recurring_content_section_title'),
        }));
        section.appendChild(this.deps.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('recurring_content_section_intro'),
        }));

        const refresh_btn = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            attributes: { type: 'button' },
            text_content: t('recurring_content_refresh_button'),
        });
        refresh_btn.addEventListener('click', () => void this.load_suggestions());
        section.appendChild(refresh_btn);

        if (this.loading) {
            section.appendChild(this.deps.Helpers.create_element('p', {
                text_content: t('recurring_content_loading'),
            }));
            this.root.appendChild(section);
            return;
        }

        if (this.suggestions.length === 0) {
            section.appendChild(this.deps.Helpers.create_element('p', {
                text_content: t('recurring_content_none'),
            }));
            this.root.appendChild(section);
            return;
        }

        const list = this.deps.Helpers.create_element('ul', { class_name: 'recurring-content-list' });
        for (const suggestion of this.suggestions) {
            const li = this.deps.Helpers.create_element('li', { class_name: 'recurring-content-list-item' });
            const type_key = RECURRING_LABEL_KEYS[String(suggestion.candidateType || '')] || 'recurring_content_type_other';
            const category_id = resolve_recurring_sample_category_id(
                (this.deps.getState().ruleFileContent as { metadata?: unknown } | undefined)?.metadata
            );
            const already_exists = category_id
                ? recurring_sample_exists(this.deps.getState().samples, category_id, {
                    candidateType: String(suggestion.candidateType || ''),
                    structureFingerprint: String(suggestion.structureFingerprint || ''),
                })
                : false;

            li.appendChild(this.deps.Helpers.create_element('p', {
                text_content: t('recurring_content_item_summary', {
                    type: t(type_key),
                    count: suggestion.occursOnPageCount,
                    total: suggestion.totalPageCount,
                }),
            }));

            if (!already_exists) {
                const create_btn = this.deps.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    attributes: { type: 'button' },
                    text_content: t('recurring_content_create_sample_button'),
                });
                create_btn.addEventListener('click', () => this.handle_create_sample(suggestion));
                li.appendChild(create_btn);
            } else {
                li.appendChild(this.deps.Helpers.create_element('p', {
                    class_name: 'recurring-content-list-item__exists',
                    text_content: t('recurring_content_already_exists'),
                }));
            }
            list.appendChild(li);
        }
        section.appendChild(list);
        this.root.appendChild(section);
    }
}
