/**
 * @fileoverview Redigerar Bilaga 1-standardtext (inledning) i regelfilens Rapportmall.
 */
import {
    normalize_rulefile_appendix1,
    read_rulefile_appendix1_sections,
} from '../../logic/appendix1_sections.js';
import { flush_rulefile_editing_sync_if_active } from '../../logic/server_sync.js';
import {
    render_appendix1_summary_editor_page,
} from '../../utils/appendix1_summary_editor_render.js';
import { type MarkdownPreviewEditorHost } from '../../utils/markdown_preview_editor_ui.js';

type Deps = {
    router: (view: string, params?: Record<string, string>) => void;
    getState: () => Record<string, unknown>;
    dispatch: (action: unknown) => Promise<void> | void;
    StoreActionTypes: { UPDATE_RULEFILE_CONTENT: string };
    Translation: { t: (key: string) => string };
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    NotificationComponent: { show_global_message: (msg: string, type: string) => void };
};

export class EditReportTemplateAppendix1Component {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private summary_host: MarkdownPreviewEditorHost = {
        is_editing: false,
        working_text: '',
        textarea_ref: null,
        preview_container_ref: null,
    };

    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.root = root;
        this.deps = deps;
    }

    private navigate_back_to_view(): void {
        this.deps?.router('rulefile_sections', { section: 'report_template' });
    }

    private async save_introduction_content(content: string): Promise<void> {
        if (!this.deps) return;
        const state = this.deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const normalized = normalize_rulefile_appendix1(rule_file);
        const appendix = normalized.appendix1 as Record<string, unknown>;
        const sections = { ...(appendix.sections as Record<string, unknown>) };
        const existing = read_rulefile_appendix1_sections(normalized);
        sections.introduction = {
            ...existing.introduction,
            content,
        };
        appendix.sections = sections;
        normalized.appendix1 = appendix;

        await this.deps.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: normalized, skip_render: true },
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

        const state = this.deps.getState();
        const rule_file = state.ruleFileContent as Record<string, unknown> | undefined;
        const introduction_text =
            read_rulefile_appendix1_sections(rule_file).introduction?.content ?? '';

        render_appendix1_summary_editor_page(
            { Helpers: this.deps.Helpers, Translation: this.deps.Translation },
            this.root,
            {
                heading_id: 'rulefile-appendix1-summary-heading',
                heading_key: 'rulefile_appendix1_summary_heading',
                intro_key: 'rulefile_appendix1_summary_intro',
                label_key: 'rulefile_appendix1_summary_label',
                textarea_id: 'rulefile-appendix1-summary-text',
                initial_text: introduction_text,
                summary_host: this.summary_host,
                back_button_key: 'rulefile_info_blocks_back_to_view',
                on_save: (text) => this.save_introduction_content(text),
                on_discard: () => this.navigate_back_to_view(),
                on_back: () => this.navigate_back_to_view(),
            }
        );
    }

    destroy(): void {
        this.root = null;
        this.deps = null;
        this.summary_host = {
            is_editing: false,
            working_text: '',
            textarea_ref: null,
            preview_container_ref: null,
        };
    }
}
