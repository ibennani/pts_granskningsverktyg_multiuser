/**
 * @fileoverview Redigerar Bilaga 1-malltexter för aktuell granskning (auditMetadata).
 */
import {
    build_rulefile_appendix1_persisted_sections,
    normalize_rulefile_appendix1,
    read_rulefile_appendix1_body_text_by_taxonomy,
    read_rulefile_appendix1_grouping_taxonomy_id,
    resolve_appendix1_body_text,
    resolve_audit_grouping_taxonomy_id,
    resolve_principle_intro_content,
} from '../../logic/appendix1_sections.js';
import type { Appendix1SectionDefinition } from '../../logic/appendix1_sections_types.js';
import { generate_deficiency_sections_from_taxonomy } from '../../logic/appendix1_sections.js';
import { build_appendix1_override_payload } from '../../logic/audit_appendix_overrides.js';
import { sync_to_server_now } from '../../logic/server_sync.js';
import { resolve_taxonomies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { render_appendix1_sections_editor } from '../rulefile_sections/rulefile_appendix1_sections_editor_ui.js';
import { build_save_button_html_content } from '../../ui/save_button_html.js';

type Deps = {
    router: (view: string, params?: Record<string, string>) => void;
    getState: () => Record<string, unknown>;
    dispatch: (action: unknown) => Promise<void> | void;
    StoreActionTypes: { UPDATE_METADATA: string };
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
    get_sections: () => Appendix1SectionDefinition[];
    get_grouping_taxonomy_id: () => string;
    get_concept_intros: () => Record<string, string>;
};

export class EditAuditAppendix1Component {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private editor_handles: EditorHandles | null = null;

    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.root = root;
        this.deps = deps;
    }

    private navigate_back_to_view(): void {
        this.deps?.router('audit_actions', { section: 'appendix_templates', appendix: '1' });
    }

    private async save_sections(): Promise<void> {
        const deps = this.deps;
        const editor_handles = this.editor_handles;
        if (!deps || !editor_handles) return;

        const grouping_taxonomy_id = editor_handles.get_grouping_taxonomy_id();
        const body_text_by_taxonomy = editor_handles.get_body_text_by_taxonomy();
        const body_text =
            body_text_by_taxonomy[grouping_taxonomy_id]?.trim()
            ?? editor_handles.get_body_text().trim();
        const sections = build_rulefile_appendix1_persisted_sections(
            body_text,
            editor_handles.get_sections()
        );
        const payload = build_appendix1_override_payload(
            body_text,
            body_text_by_taxonomy,
            sections,
            editor_handles.get_concept_intros()
        );

        await deps.dispatch({
            type: deps.StoreActionTypes.UPDATE_METADATA,
            payload: { ...payload, skip_render: true },
        });

        deps.NotificationComponent.show_global_message(
            deps.Translation.t('audit_appendix_1_saved'),
            'success'
        );

        try {
            await sync_to_server_now(deps.getState, deps.dispatch);
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
        const taxonomy_id = resolve_audit_grouping_taxonomy_id(state);
        const taxonomies = resolve_taxonomies(normalized.metadata as Record<string, unknown>) as Array<{
            id?: string;
        }>;
        const taxonomy_ids = taxonomies
            .map((taxonomy) => String(taxonomy.id ?? '').trim())
            .filter(Boolean);
        const body_text_by_taxonomy = read_rulefile_appendix1_body_text_by_taxonomy(
            normalized,
            taxonomy_ids
        );
        const resolved_body = resolve_appendix1_body_text(state);
        body_text_by_taxonomy[taxonomy_id] = resolved_body;

        const deficiency_sections = generate_deficiency_sections_from_taxonomy(
            {
                ...normalized,
                appendix1: {
                    ...(normalized.appendix1 as Record<string, unknown> | undefined),
                    groupingTaxonomyId: read_rulefile_appendix1_grouping_taxonomy_id(normalized),
                },
            },
            this.deps.Translation.t
        );
        const initial_concept_intros: Record<string, string> = {};
        for (const section of deficiency_sections) {
            if (section.kind !== 'deficiency_group' || !section.conceptId) continue;
            initial_concept_intros[section.conceptId] = resolve_principle_intro_content(
                state,
                rule_file,
                taxonomy_id,
                section.conceptId
            );
        }

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
            normalized,
            {
                scope: 'audit',
                initial_body_text_by_taxonomy: body_text_by_taxonomy,
                initial_concept_intros,
            }
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
