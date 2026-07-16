/**
 * @fileoverview Redigerar Bilaga 3 introtext i regelfilens malltexter.
 */
import {
    normalize_rulefile_appendix3,
    read_rulefile_appendix3_template,
} from '../../logic/appendix3_screenshots_template.js';
import { flush_rulefile_editing_sync_if_active } from '../../logic/server_sync.js';
import {
    build_markdown_preview_editor_ui,
    type MarkdownPreviewEditorHost,
} from '../../utils/markdown_preview_editor_ui.js';
import { create_rulefile_appendix_subpage_back_row } from './rulefile_appendix_templates_render.js';
import '../../components/markdown_preview_editor.css';
import '../audit_settings_view_component.css';
import { build_save_button_html_content } from '../../ui/save_button_html.js';

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

export class EditReportTemplateAppendix3Component {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private intro_host: MarkdownPreviewEditorHost = {
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
        this.deps?.router('rulefile_sections', { section: 'report_template', appendix: '3' });
    }

    private navigate_back_to_hub(): void {
        this.deps?.router('rulefile_sections', { section: 'report_template' });
    }

    private async save_template(): Promise<void> {
        if (!this.root || !this.deps) return;
        const state = this.deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const normalized = normalize_rulefile_appendix3(rule_file);
        const appendix = normalized.appendix3 as Record<string, unknown>;
        appendix.introText = this.intro_host.working_text;
        normalized.appendix3 = appendix;

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
            this.deps.Translation.t('rulefile_appendix3_saved'),
            'success'
        );
    }

    render(): void {
        if (!this.root || !this.deps) return;
        this.root.innerHTML = '';

        const { Helpers: helpers, Translation: { t } } = this.deps;
        const rule_file = this.deps.getState().ruleFileContent as Record<string, unknown> | undefined;
        const template = read_rulefile_appendix3_template(rule_file);

        this.root.appendChild(
            helpers.create_element('h1', {
                attributes: { id: 'rulefile-appendix3-heading' },
                text_content: t('rulefile_appendix3_edit_heading'),
            })
        );
        this.root.appendChild(
            helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: t('rulefile_appendix3_edit_intro'),
            })
        );

        this.intro_host.working_text = template.introText;
        this.intro_host.is_editing = false;
        const intro_section = build_markdown_preview_editor_ui(
            { Helpers: helpers, Translation: this.deps.Translation },
            this.intro_host,
            {
                label_key: 'rulefile_appendix3_intro_label',
                textarea_id: 'rulefile-appendix3-intro-text',
                initial_text: template.introText,
            }
        );
        this.root.appendChild(intro_section);

        const actions = helpers.create_element('div', { class_name: 'form-actions' });
        const save_btn = helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: build_save_button_html_content(t('save_changes_button')),
        });
        save_btn.addEventListener('click', () => {
            void this.save_template();
        });
        const discard_btn = helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: t('rulefile_info_blocks_back_to_view'),
        });
        discard_btn.addEventListener('click', () => this.navigate_back_to_view());
        actions.appendChild(save_btn);
        actions.appendChild(discard_btn);
        this.root.appendChild(actions);

        this.root.appendChild(
            create_rulefile_appendix_subpage_back_row(
                { Helpers: helpers, Translation: this.deps.Translation, router: this.deps.router },
                () => this.navigate_back_to_hub()
            )
        );
    }

    destroy(): void {
        this.root = null;
        this.deps = null;
        this.intro_host = {
            is_editing: false,
            working_text: '',
            textarea_ref: null,
            preview_container_ref: null,
        };
    }
}
