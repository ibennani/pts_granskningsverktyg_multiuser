/**
 * @fileoverview Vy «Inställningar» – hub och undersidor för granskning.
 */
import { MetadataFormComponent } from './MetadataFormComponent.js';
import { sync_to_server_now } from '../logic/server_sync.js';
import { audit_status_allows_metadata_edit, audit_status_is_fully_readonly } from '../utils/audit_status_helpers.js';
import { type MarkdownPreviewEditorHost } from '../utils/markdown_preview_editor_ui.js';
import { with_initialized_appendix1_summary_metadata } from '../logic/appendix1_summary_text.js';
import {
    normalize_audit_settings_section,
    normalize_audit_settings_return_to,
    render_audit_settings_hub,
    render_audit_settings_information_section,
    render_audit_settings_summary_section,
} from './audit_settings_render.js';
import {
    create_principle_intro_host,
    render_audit_settings_principle_intros_section,
} from '../utils/audit_appendix1_principle_intros_render.js';
import './audit_settings_view_component.css';

type Deps = Record<string, unknown> & {
    router: (view: string, params?: Record<string, string>) => void;
    params?: Record<string, string>;
    getState: () => Record<string, unknown>;
    dispatch: (action: unknown) => Promise<void> | void;
    StoreActionTypes: { UPDATE_METADATA: string };
    Translation: { t: (key: string) => string };
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    NotificationComponent: { show_global_message: (msg: string, type: string) => void };
};

export class AuditSettingsViewComponent {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private metadata_container: HTMLElement | null = null;
    private summary_host: MarkdownPreviewEditorHost = {
        is_editing: false,
        working_text: '',
        textarea_ref: null,
        preview_container_ref: null,
    };
    private principle_intro_host = create_principle_intro_host();
    private readonly RETURN_FOCUS_SESSION_KEY = 'gv_return_focus_audit_info_h2_v1';

    init({ root, deps }: { root: HTMLElement; deps: Deps }): void {
        this.root = root;
        this.deps = deps;
        this.handle_form_submit = this.handle_form_submit.bind(this);
        this.handle_back = this.handle_back.bind(this);
    }

    private request_focus_on_audit_info_h2(): void {
        try {
            if (window.sessionStorage) {
                window.sessionStorage.setItem(
                    this.RETURN_FOCUS_SESSION_KEY,
                    JSON.stringify({ focus: 'audit_info_h2' })
                );
            }
        } catch {
            // Ignorera
        }
        window.customFocusApplied = true;
    }

    private ensure_initialized_state(): Record<string, unknown> {
        if (!this.deps) return {};
        const state = this.deps.getState();
        const meta = state.auditMetadata as Record<string, unknown> | undefined;
        if (meta && Object.prototype.hasOwnProperty.call(meta, 'appendix1SummaryText')) {
            return state;
        }
        const initialized = with_initialized_appendix1_summary_metadata(state);
        void this.deps.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_METADATA,
            payload: {
                appendix1SummaryText: (
                    initialized.auditMetadata as { appendix1SummaryText?: string }
                )?.appendix1SummaryText ?? '',
                skip_render: true,
            },
        });
        return initialized;
    }

    async handle_form_submit(form_data: Record<string, unknown>): Promise<void> {
        if (!this.deps) return;
        await this.deps.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_METADATA,
            payload: form_data,
        });
        try {
            await sync_to_server_now(this.deps.getState, this.deps.dispatch);
        } catch {
            // Fel visas av sync
        }
        this.deps.NotificationComponent.show_global_message(
            this.deps.Translation.t('metadata_updated_successfully'),
            'success'
        );
        this.request_focus_on_audit_info_h2();
        this.deps.router('audit_overview');
    }

    handle_back(): void {
        const return_to = normalize_audit_settings_return_to(this.deps?.params?.returnTo);
        if (return_to === 'overview') {
            this.request_focus_on_audit_info_h2();
            this.deps?.router('audit_overview');
            return;
        }
        this.deps?.router('audit_settings');
    }

    private async save_summary_text(text: string): Promise<void> {
        if (!this.deps) return;
        await this.deps.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_METADATA,
            payload: {
                appendix1SummaryText: text,
                appendix1SectionOverrides: {
                    introduction: {
                        title: '1. Inledning',
                        content: text,
                        format: 'paragraphs',
                    },
                },
                skip_render: true,
            },
        });
        try {
            await sync_to_server_now(this.deps.getState, this.deps.dispatch);
        } catch {
            // Fel visas av sync
        }
        this.deps.NotificationComponent.show_global_message(
            this.deps.Translation.t('audit_appendix1_summary_saved'),
            'success'
        );
    }

    private async save_principle_intros(overrides: Record<string, string>): Promise<void> {
        if (!this.deps) return;
        await this.deps.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_METADATA,
            payload: {
                appendix1PrincipleIntroOverrides: overrides,
                skip_render: true,
            },
        });
        try {
            await sync_to_server_now(this.deps.getState, this.deps.dispatch);
        } catch {
            // Fel visas av sync
        }
        this.deps.NotificationComponent.show_global_message(
            this.deps.Translation.t('audit_settings_principle_intros_saved'),
            'success'
        );
    }

    render(): void {
        if (!this.root || !this.deps) return;
        this.root.innerHTML = '';

        const state = this.ensure_initialized_state();
        const status = String(state.auditStatus ?? '');
        if (status === 'not_started') {
            this.deps.router('metadata');
            return;
        }
        if (!state.ruleFileContent) {
            this.deps.router('start');
            return;
        }

        const section = normalize_audit_settings_section(this.deps.params?.section);
        const return_to = normalize_audit_settings_return_to(this.deps.params?.returnTo);
        const can_edit = audit_status_allows_metadata_edit(status);
        const readonly = audit_status_is_fully_readonly(status) || !can_edit;

        const plate = this.deps.Helpers.create_element('div', {
            class_name: 'content-plate audit-settings-plate',
        });

        const render_deps = {
            Helpers: this.deps.Helpers,
            Translation: this.deps.Translation,
            router: this.deps.router,
        };

        if (section === 'information') {
            const metadata_ref = { current: this.metadata_container };
            render_audit_settings_information_section(
                render_deps,
                plate,
                {
                    state,
                    readonly,
                    status,
                    return_to,
                    metadata_container_ref: metadata_ref,
                    full_deps: this.deps,
                    handlers: {
                        on_metadata_submit: (form_data) => this.handle_form_submit(form_data),
                        on_back: () => this.handle_back(),
                        on_summary_save: (text) => this.save_summary_text(text),
                    },
                }
            );
            this.metadata_container = metadata_ref.current;
        } else if (section === 'principle_intros') {
            this.metadata_container = null;
            render_audit_settings_principle_intros_section(render_deps, plate, {
                state,
                readonly,
                return_to,
                intro_host: this.principle_intro_host,
                on_save: (overrides) => this.save_principle_intros(overrides),
                on_back: () => this.handle_back(),
            });
        } else if (section === 'summary') {
            this.metadata_container = null;
            render_audit_settings_summary_section(render_deps, plate, {
                state,
                readonly,
                return_to,
                summary_host: this.summary_host,
                handlers: {
                    on_summary_save: (text) => this.save_summary_text(text),
                    on_back: () => this.handle_back(),
                },
            });
        } else {
            this.metadata_container = null;
            render_audit_settings_hub(render_deps, plate);
        }

        this.root.appendChild(plate);
    }

    destroy(): void {
        if (this.metadata_container) {
            MetadataFormComponent.destroy?.();
        }
        this.root = null;
        this.deps = null;
        this.metadata_container = null;
    }
}
