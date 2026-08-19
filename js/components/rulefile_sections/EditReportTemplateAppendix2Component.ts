/**
 * @fileoverview Redigerar Bilaga 2 Excel-etiketter i regelfilens malltexter.
 */
import {
    APPENDIX2_DEFICIENCY_COLUMN_KEYS,
    APPENDIX2_GENERAL_INFO_KEYS,
    normalize_rulefile_appendix2,
    read_rulefile_appendix2_labels,
    read_rulefile_metadata_language,
} from '../../logic/appendix2_excel_template.js';
import { flush_rulefile_editing_sync_if_active } from '../../logic/server_sync.js';
import {
    create_appendix2_excel_editor,
    create_appendix2_labels_host,
    read_appendix2_sheet_names_from_host,
    read_input_label_values,
    type Appendix2SheetEditorHost,
} from './appendix2_excel_editor_ui.js';
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

export class EditReportTemplateAppendix2Component {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private sheet_host: Appendix2SheetEditorHost | null = null;

    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.root = root;
        this.deps = deps;
    }

    private navigate_back_to_view(): void {
        this.deps?.router('rulefile_sections', { section: 'report_template', appendix: '2' });
    }

    private async save_labels(): Promise<void> {
        if (!this.root || !this.deps || !this.sheet_host) return;
        const state = this.deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const normalized = normalize_rulefile_appendix2(rule_file);
        const locale = read_rulefile_metadata_language(normalized);
        const appendix = normalized.appendix2 as Record<string, unknown>;
        const labels_by_locale = { ...(appendix.labelsByLocale as Record<string, unknown>) };

        labels_by_locale[locale] = {
            sheetNames: read_appendix2_sheet_names_from_host(this.sheet_host),
            generalInfo: read_input_label_values(this.root, 'appendix2-general', APPENDIX2_GENERAL_INFO_KEYS),
            deficiencyColumns: read_input_label_values(
                this.root,
                'appendix2-deficiency',
                APPENDIX2_DEFICIENCY_COLUMN_KEYS
            ),
        };

        appendix.labelsByLocale = labels_by_locale;
        normalized.appendix2 = appendix;

        await this.deps.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: normalized, skip_render: true },
        });

        try {
            await flush_rulefile_editing_sync_if_active(this.deps.getState, this.deps.dispatch, {
                bump_version: true
            });
        } catch {
            // Fel visas av sync
        }
        this.deps.NotificationComponent.show_global_message(
            this.deps.Translation.t('rulefile_appendix2_saved'),
            'success'
        );
    }

    render(): void {
        if (!this.root || !this.deps) return;
        this.root.innerHTML = '';

        const { Helpers: helpers, Translation: { t } } = this.deps;
        const rule_file = this.deps.getState().ruleFileContent as Record<string, unknown> | undefined;
        const labels = read_rulefile_appendix2_labels(rule_file);
        this.sheet_host = create_appendix2_labels_host(labels);

        this.root.appendChild(
            helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: t('rulefile_appendix2_edit_intro'),
            })
        );

        const form = helpers.create_element('form', { class_name: 'rulefile-appendix2-form' });
        create_appendix2_excel_editor(helpers, t, this.sheet_host, form, labels);

        const actions = helpers.create_element('div', { class_name: 'form-actions' });
        const save_btn = helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'submit' },
            html_content: build_save_button_html_content(t('save_changes_button')),
        });
        const discard_btn = helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: t('rulefile_info_blocks_back_to_view'),
        });
        discard_btn.addEventListener('click', () => this.navigate_back_to_view());
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            void this.save_labels();
        });
        actions.appendChild(save_btn);
        actions.appendChild(discard_btn);
        form.appendChild(actions);
        this.root.appendChild(form);
    }

    destroy(): void {
        this.root = null;
        this.deps = null;
        this.sheet_host = null;
    }
}
