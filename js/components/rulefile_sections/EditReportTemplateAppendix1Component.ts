/**
 * @fileoverview Redigerar Bilaga 1-sektioner och grupperingstaxonomi i regelfilens Rapportmall.
 */
import { normalize_rulefile_appendix1 } from '../../logic/appendix1_sections.js';
import { flush_rulefile_editing_sync_if_active } from '../../logic/server_sync.js';
import { create_rulefile_appendix_subpage_back_row } from './rulefile_appendix_templates_render.js';
import { render_appendix1_sections_editor } from './rulefile_appendix1_sections_editor_ui.js';
import { build_save_button_html_content } from '../../ui/save_button_html.js';

type Deps = {
    router: (view: string, params?: Record<string, string>) => void;
    getState: () => Record<string, unknown>;
    dispatch: (action: unknown) => Promise<void> | void;
    StoreActionTypes: { UPDATE_RULEFILE_CONTENT: string };
    Translation: { t: (key: string) => string };
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        get_icon_svg?: (name: string) => string;
    };
    NotificationComponent: { show_global_message: (msg: string, type: string) => void };
};

type EditorHandles = {
    get_sections: () => Array<Record<string, unknown>>;
    get_grouping_taxonomy_id: () => string;
};

export class EditReportTemplateAppendix1Component {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private editor_handles: EditorHandles | null = null;

    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.root = root;
        this.deps = deps;
    }

    private navigate_back_to_view(): void {
        this.deps?.router('rulefile_sections', { section: 'report_template', appendix: '1' });
    }

    private navigate_back_to_hub(): void {
        this.deps?.router('rulefile_sections', { section: 'report_template' });
    }

    private async save_sections(): Promise<void> {
        if (!this.deps || !this.editor_handles) return;
        const state = this.deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const normalized = normalize_rulefile_appendix1(rule_file);
        const appendix = (normalized.appendix1 as Record<string, unknown>) || {};
        appendix.sections = this.editor_handles.get_sections();
        appendix.groupingTaxonomyId = this.editor_handles.get_grouping_taxonomy_id();
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
            this.deps.Translation.t('rulefile_appendix1_section_saved'),
            'success'
        );
    }

    render(): void {
        if (!this.root || !this.deps) return;
        this.root.innerHTML = '';

        const state = this.deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const normalized = normalize_rulefile_appendix1(rule_file);

        const heading = this.deps.Helpers.create_element('h2', {
            attributes: { id: 'rulefile-appendix1-sections-heading' },
            text_content: this.deps.Translation.t('rulefile_appendix1_sections_edit_heading'),
        });
        this.root.appendChild(heading);

        const editor_host = this.deps.Helpers.create_element('div', {
            class_name: 'appendix1-sections-editor-host',
        });
        this.editor_handles = render_appendix1_sections_editor(
            { Helpers: this.deps.Helpers, Translation: this.deps.Translation },
            editor_host,
            normalized
        );
        this.root.appendChild(editor_host);

        const actions = this.deps.Helpers.create_element('div', { class_name: 'form-actions' });
        const save_btn = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: build_save_button_html_content(
                this.deps.Translation.t('save_changes_button')
            ),
        });
        save_btn.addEventListener('click', () => {
            void this.save_sections();
        });
        const back_btn = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: this.deps.Translation.t('rulefile_info_blocks_back_to_view'),
        });
        back_btn.addEventListener('click', () => this.navigate_back_to_view());
        actions.append(save_btn, back_btn);
        this.root.appendChild(actions);

        this.root.appendChild(
            create_rulefile_appendix_subpage_back_row(
                { Helpers: this.deps.Helpers, Translation: this.deps.Translation, router: this.deps.router },
                () => this.navigate_back_to_hub()
            )
        );
    }

    destroy(): void {
        this.root = null;
        this.deps = null;
        this.editor_handles = null;
    }
}
