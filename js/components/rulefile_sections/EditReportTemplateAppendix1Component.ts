/**
 * @fileoverview Redigerar Bilaga 1-standardtext i regelfilens Rapportmall-sektion.
 */
import {
    build_markdown_preview_editor_ui,
    type MarkdownPreviewEditorHost,
} from '../../utils/markdown_preview_editor_ui.js';
import {
    normalize_rulefile_appendix1,
    read_rulefile_appendix1_summary_text,
} from '../../logic/appendix1_summary_text.js';
import { flush_rulefile_editing_sync_if_active } from '../../logic/server_sync.js';

type Deps = {
    router: (view: string, params?: Record<string, string>) => void;
    getState: () => Record<string, unknown>;
    dispatch: (action: unknown) => Promise<void> | void;
    StoreActionTypes: { UPDATE_RULEFILE_CONTENT: string };
    Translation: { t: (key: string) => string };
    Helpers: {
        create_element: (
            tag: string,
            opts?: Record<string, unknown>
        ) => HTMLElement;
    };
    NotificationComponent: { show_global_message: (msg: string, type: string) => void };
};

export class EditReportTemplateAppendix1Component {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private preview_host: MarkdownPreviewEditorHost = {
        is_editing: false,
        working_text: '',
        textarea_ref: null,
        preview_container_ref: null,
    };

    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.root = root;
        this.deps = deps;
    }

    private get_working_text(): string {
        const state = this.deps?.getState();
        const rule_file = state?.ruleFileContent as Record<string, unknown> | undefined;
        return read_rulefile_appendix1_summary_text(rule_file);
    }

    private async save_summary_text(text: string): Promise<void> {
        if (!this.deps) return;
        const state = this.deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const normalized = normalize_rulefile_appendix1(rule_file);
        normalized.appendix1 = {
            ...(normalized.appendix1 as Record<string, unknown>),
            summaryText: text,
        };

        await this.deps.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: {
                ruleFileContent: normalized,
                skip_render: true,
            },
        });

        try {
            await flush_rulefile_editing_sync_if_active(this.deps.getState, this.deps.dispatch);
        } catch {
            // Fel visas av sync
        }
        this.deps.NotificationComponent.show_global_message(
            this.deps.Translation.t('rulefile_appendix1_summary_saved'),
            'success'
        );
    }

    render(): void {
        if (!this.root || !this.deps) return;
        this.root.innerHTML = '';
        this.preview_host.working_text = this.get_working_text();
        this.preview_host.is_editing = false;

        const t = this.deps.Translation.t;
        const intro = this.deps.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_appendix1_summary_intro'),
        });
        this.root.appendChild(intro);

        const page_header = this.deps.Helpers.create_element('div', {
            class_name: 'markdown-preview-editor__page-header-row',
        });
        page_header.appendChild(
            this.deps.Helpers.create_element('h2', {
                attributes: { id: 'rulefile-appendix1-summary-heading' },
                text_content: t('rulefile_appendix1_summary_heading'),
            })
        );
        this.root.appendChild(page_header);

        const editor = build_markdown_preview_editor_ui(
            { Helpers: this.deps.Helpers, Translation: this.deps.Translation },
            this.preview_host,
            {
                label_key: 'rulefile_appendix1_summary_label',
                textarea_id: 'rulefile-appendix1-summary-text',
                initial_text: this.preview_host.working_text,
                hide_heading: true,
                external_edit_button_container: page_header,
                on_save: async (text) => {
                    await this.save_summary_text(text);
                },
            }
        );
        this.root.appendChild(editor);
    }

    destroy(): void {
        this.root = null;
        this.deps = null;
        this.preview_host = {
            is_editing: false,
            working_text: '',
            textarea_ref: null,
            preview_container_ref: null,
        };
    }
}
