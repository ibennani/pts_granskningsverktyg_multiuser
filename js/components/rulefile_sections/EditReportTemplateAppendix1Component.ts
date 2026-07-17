/**
 * @fileoverview Redigerar Bilaga 1-sektioner och grupperingstaxonomi i regelfilens Rapportmall.
 */
import {
    build_rulefile_appendix1_persisted_sections,
    normalize_rulefile_appendix1,
} from '../../logic/appendix1_sections.js';
import { merge_concept_intros_into_metadata } from '../../logic/appendix1_principle_intro.js';
import type { Appendix1SectionDefinition } from '../../logic/appendix1_sections_types.js';
import { flush_rulefile_editing_sync_if_active } from '../../logic/server_sync.js';
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
    get_body_text: () => string;
    get_body_text_by_taxonomy: () => Record<string, string>;
    get_sections: () => Array<Record<string, unknown>>;
    get_grouping_taxonomy_id: () => string;
    get_concept_intros: () => Record<string, string>;
    get_editing_audit_type_id: () => string;
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

    private async save_sections(
        success_message_key = 'rulefile_appendix1_section_saved'
    ): Promise<void> {
        const deps = this.deps;
        const editor_handles = this.editor_handles;
        if (!deps || !editor_handles) return;

        const state = deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const normalized = normalize_rulefile_appendix1(rule_file);
        const appendix = (normalized.appendix1 as Record<string, unknown>) || {};
        const grouping_taxonomy_id = editor_handles.get_grouping_taxonomy_id();
        const body_text_by_taxonomy = editor_handles.get_body_text_by_taxonomy();
        const editing_audit_type_id = editor_handles.get_editing_audit_type_id?.() ?? '';
        appendix.bodyTextByTaxonomy = body_text_by_taxonomy;
        const body_text =
            body_text_by_taxonomy[grouping_taxonomy_id]?.trim()
            ?? editor_handles.get_body_text().trim();
        if (editing_audit_type_id) {
            const by_audit_type =
                appendix.byAuditType && typeof appendix.byAuditType === 'object'
                    ? { ...(appendix.byAuditType as Record<string, unknown>) }
                    : {};
            by_audit_type[editing_audit_type_id] = {
                bodyTextByTaxonomy: body_text_by_taxonomy,
                bodyText: body_text,
            };
            appendix.byAuditType = by_audit_type;
        } else {
            appendix.bodyText = body_text;
        }
        appendix.sections = build_rulefile_appendix1_persisted_sections(
            body_text,
            editor_handles.get_sections() as Appendix1SectionDefinition[]
        );
        appendix.groupingTaxonomyId = grouping_taxonomy_id;
        merge_concept_intros_into_metadata(
            normalized,
            grouping_taxonomy_id,
            editor_handles.get_concept_intros()
        );
        normalized.appendix1 = appendix;

        await deps.dispatch({
            type: deps.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: normalized, skip_render: true },
        });

        // Visa toast före serversynk: flush kan trigga omrendering som förstör komponenten.
        deps.NotificationComponent.show_global_message(
            deps.Translation.t(success_message_key),
            'success'
        );

        try {
            await flush_rulefile_editing_sync_if_active(deps.getState, deps.dispatch);
        } catch {
            // Fel visas av sync
        }
    }

    render(): void {
        if (!this.root || !this.deps) return;
        this.root.innerHTML = '';

        const state = this.deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const normalized = normalize_rulefile_appendix1(rule_file);

        const editor_host = this.deps.Helpers.create_element('div', {
            class_name: 'appendix1-sections-editor-host',
        });
        this.editor_handles = render_appendix1_sections_editor(
            {
                Helpers: this.deps.Helpers,
                Translation: this.deps.Translation,
                NotificationComponent: this.deps.NotificationComponent,
            },
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
    }

    destroy(): void {
        this.root = null;
        this.deps = null;
        this.editor_handles = null;
    }
}
