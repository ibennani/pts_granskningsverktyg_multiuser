/**

 * @fileoverview Redigerar regelfilens klassificeringar per hub-del (part).

 */

import { clone_metadata, ensure_metadata_defaults } from '../../logic/rulefile_metadata_model.js';

import { flush_rulefile_editing_sync_if_active } from '../../logic/server_sync.js';

import { normalize_rulefile_metadata_vocabularies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';

import { normalize_audit_types_for_persist } from '../../../shared/rulefile/rulefile_audit_types.js';

import { finalize_taxonomy_ids_for_persist } from '../../logic/taxonomy_persist.js';

import {

    normalize_classification_part_param,

    type ClassificationPartId,

} from './rulefile_classifications_parts.js';

import {

    append_draft_taxonomy_on_save,

    render_taxonomy_editor_ui,

    resolve_taxonomy_key_after_save,

} from './rulefile_taxonomy_editor_ui.js';

import type { TaxonomyEntryPersist } from '../../logic/taxonomy_persist.js';

import { render_requirement_mapping_ui } from './rulefile_requirement_mapping_ui.js';

import { render_audit_types_editor } from './rulefile_audit_types_ui.js';

import { render_deficiency_types_editor } from './rulefile_deficiency_types_ui.js';

import { build_save_button_html_content } from '../../ui/save_button_html.js';

import '../edit_rulefile_metadata_view.css';



type Deps = {

    router: (view: string, params?: Record<string, string>) => void;

    getState: () => Record<string, unknown>;

    dispatch: (action: unknown) => Promise<void> | void;

    StoreActionTypes: { UPDATE_RULEFILE_CONTENT: string };

    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };

    Helpers: {

        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;

        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;

    };

    NotificationComponent: { show_global_message: (msg: string, type: string) => void };

    AutosaveService?: { create_session?: (opts: unknown) => { request_autosave?: () => void; destroy?: () => void } };

    params?: Record<string, string>;

};



export class EditRulefileClassificationsComponent {

    private root: HTMLElement | null = null;

    private deps: Deps | null = null;

    private form_element_ref: HTMLFormElement | null = null;

    private working_metadata: Record<string, unknown> | null = null;

    private part: ClassificationPartId = 'taxonomy';

    private taxonomy_id = '';

    private panel_container: HTMLElement | null = null;

    private mapping_apply: (() => Record<string, unknown>) | null = null;

    private deficiency_apply: (() => Record<string, unknown>) | null = null;

    private autosave_session: { request_autosave?: () => void; destroy?: () => void } | null = null;

    private draft_taxonomy: TaxonomyEntryPersist | null = null;

    skip_autosave_on_destroy = false;



    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {

        this.root = root;

        this.deps = deps;

        this.form_element_ref = null;

        this.working_metadata = null;

        this.part = normalize_classification_part_param(deps.params?.part) || 'taxonomy';

        this.taxonomy_id = String(deps.params?.taxonomyId ?? '').trim();

        this.panel_container = null;

        this.mapping_apply = null;

        this.deficiency_apply = null;

        this.autosave_session = null;

        this.draft_taxonomy = null;

        this.skip_autosave_on_destroy = false;

    }



    private get_editor_ctx() {

        if (!this.deps) throw new Error('Missing deps');

        return { Helpers: this.deps.Helpers, Translation: this.deps.Translation, router: this.deps.router };

    }



    private ensure_working_metadata(): Record<string, unknown> {

        if (this.working_metadata) return this.working_metadata;

        const state = this.deps?.getState() ?? {};

        const base = ((state.ruleFileContent as Record<string, unknown> | undefined)?.metadata ??

            {}) as Record<string, unknown>;

        this.working_metadata = ensure_metadata_defaults(clone_metadata(base)) as Record<string, unknown>;

        return this.working_metadata;

    }



    private ensure_draft_taxonomy(): TaxonomyEntryPersist {

        if (!this.draft_taxonomy) {

            this.draft_taxonomy = { id: '', label: '', version: '', uri: '', concepts: [] };

        }

        return this.draft_taxonomy;

    }



    private find_working_taxonomy_entry(working: Record<string, unknown>): TaxonomyEntryPersist | null {
        if (!this.taxonomy_id) return null;
        const taxonomies = (working.taxonomies ?? []) as TaxonomyEntryPersist[];
        return (
            taxonomies.find((row, index) => {
                const id = String(row.id ?? '').trim();
                if (id && id.toLowerCase() === this.taxonomy_id.toLowerCase()) return true;
                return `taxonomy-${index + 1}`.toLowerCase() === this.taxonomy_id.toLowerCase();
            }) ?? null
        );
    }

    private dispatch_save(rule_file_content: Record<string, unknown>, skip_render: boolean): void {

        this.deps?.dispatch({

            type: this.deps.StoreActionTypes.UPDATE_RULEFILE_CONTENT,

            payload: { ruleFileContent: rule_file_content, skip_render },

        });

    }



    private build_updated_rulefile(skip_render: boolean): Record<string, unknown> {

        const state = this.deps!.getState();

        const current = (state.ruleFileContent as Record<string, unknown>) || {};

        const working = this.ensure_working_metadata();

        finalize_taxonomy_ids_for_persist(working);
        normalize_audit_types_for_persist(working);

        const normalized_metadata = normalize_rulefile_metadata_vocabularies({ ...working }, { mode: 'read' });



        let next_rulefile: Record<string, unknown> = {

            ...current,

            metadata: { ...(current.metadata as object), ...normalized_metadata },

        };



        if (this.mapping_apply) {

            next_rulefile = this.mapping_apply();

            next_rulefile.metadata = { ...(next_rulefile.metadata as object), ...normalized_metadata };

        }

        if (this.deficiency_apply) {

            next_rulefile = this.deficiency_apply();

            next_rulefile.metadata = { ...(next_rulefile.metadata as object), ...normalized_metadata };

        }



        this.dispatch_save(next_rulefile, skip_render);

        return next_rulefile;

    }



    private handle_autosave_input = (): void => {

        this.autosave_session?.request_autosave?.();

    };



    private perform_save(skip_render: boolean): void {

        this.build_updated_rulefile(skip_render);

    }



    private render_panel(): void {

        if (!this.panel_container || !this.deps) return;

        this.panel_container.innerHTML = '';

        const ctx = this.get_editor_ctx();

        const state = this.deps.getState();

        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};



        if (this.part === 'taxonomy') {

            const is_create = !this.taxonomy_id;

            render_taxonomy_editor_ui(ctx, this.panel_container, this.ensure_working_metadata(), {

                taxonomy_key: this.taxonomy_id || undefined,

                is_create,

                draft_taxonomy: is_create ? this.ensure_draft_taxonomy() : undefined,

                on_change: this.handle_autosave_input,

            });

            return;

        }

        if (this.part === 'mapping') {

            const mapping = render_requirement_mapping_ui(

                ctx,

                this.panel_container,

                { ...rule_file, metadata: this.ensure_working_metadata() },

                this.handle_autosave_input

            );

            this.mapping_apply = mapping.apply_changes;

            return;

        }

        if (this.part === 'audit_types') {

            render_audit_types_editor(ctx, this.panel_container, this.ensure_working_metadata(), {

                on_change: this.handle_autosave_input,

            });

            return;

        }

        const deficiency = render_deficiency_types_editor(

            ctx,

            this.panel_container,

            rule_file,

            { on_change: this.handle_autosave_input }

        );

        this.deficiency_apply = deficiency.apply_changes;

    }



    private resolve_saved_taxonomy_key(): string {

        const working = this.ensure_working_metadata();

        if (!this.taxonomy_id && this.draft_taxonomy) {

            return resolve_taxonomy_key_after_save(working, this.draft_taxonomy);

        }

        finalize_taxonomy_ids_for_persist(working);

        const taxonomies = (working.taxonomies ?? []) as TaxonomyEntryPersist[];

        const match = taxonomies.find((row, index) => {

            const id = String(row.id ?? '').trim();

            if (id && id.toLowerCase() === this.taxonomy_id.toLowerCase()) return true;

            return `taxonomy-${index + 1}`.toLowerCase() === this.taxonomy_id.toLowerCase();

        });

        if (match) {

            return resolve_taxonomy_key_after_save(working, match);

        }

        return this.taxonomy_id;

    }



    private navigate_back_to_part_view(): void {

        const params: Record<string, string> = { section: 'classifications', part: this.part };

        if (this.part === 'taxonomy') {

            if (this.taxonomy_id) {

                params.taxonomyId = this.taxonomy_id;

            } else {

                delete params.taxonomyId;

            }

        }

        this.deps?.router('rulefile_sections', params);

    }



    private async save_and_sync(): Promise<void> {

        if (!this.deps) return;

        if (this.part === 'taxonomy' && !this.taxonomy_id && this.draft_taxonomy) {
            append_draft_taxonomy_on_save(this.ensure_working_metadata(), this.draft_taxonomy);
        }

        this.build_updated_rulefile(true);

        try {

            await flush_rulefile_editing_sync_if_active(this.deps.getState, this.deps.dispatch);

        } catch {

            // Sync-fel hanteras av tjänsten

        }

        this.deps.NotificationComponent.show_global_message(

            this.deps.Translation.t('rulefile_classifications_saved'),

            'success'

        );

        if (this.part === 'taxonomy') {

            const saved_key = this.resolve_saved_taxonomy_key();

            this.deps.router('rulefile_sections', {

                section: 'classifications',

                part: 'taxonomy',

                taxonomyId: saved_key,

            });

            return;

        }

        this.navigate_back_to_part_view();
    }



    render(): void {

        if (!this.root || !this.deps) return;

        this.root.innerHTML = '';

        this.part = normalize_classification_part_param(this.deps.params?.part) || 'taxonomy';

        this.taxonomy_id = String(this.deps.params?.taxonomyId ?? '').trim();

        this.mapping_apply = null;

        this.deficiency_apply = null;

        this.ensure_working_metadata();



        const form = this.deps.Helpers.create_element('form', {

            class_name: 'rulefile-classifications-edit-form',

        }) as HTMLFormElement;

        this.form_element_ref = form;



        this.panel_container = this.deps.Helpers.create_element('div', {

            class_name: 'classifications-part-panel',

        });

        form.appendChild(this.panel_container);



        const actions = this.deps.Helpers.create_element('div', { class_name: 'form-actions' });

        const save_button = this.deps.Helpers.create_element('button', {

            class_name: ['button', 'button-primary'],

            attributes: { type: 'submit' },

            html_content: build_save_button_html_content(this.deps.Translation.t('save_changes_button')),

        });

        const back_button = this.deps.Helpers.create_element('button', {

            class_name: ['button', 'button-default'],

            attributes: { type: 'button' },

            text_content: this.deps.Translation.t('rulefile_info_blocks_back_to_view'),

        });

        back_button.addEventListener('click', () => this.navigate_back_to_part_view());

        actions.append(save_button, back_button);

        form.appendChild(actions);



        form.addEventListener('submit', (event) => {

            event.preventDefault();

            void this.save_and_sync();

        });



        this.root.appendChild(form);

        this.render_panel();



        if (this.deps.AutosaveService?.create_session) {
            const skip_create_autosave = this.part === 'taxonomy' && !this.taxonomy_id;
            if (!skip_create_autosave) {
                this.autosave_session = this.deps.AutosaveService.create_session({
                    save: () => this.perform_save(true),
                });
            }
        }

    }



    destroy(): void {

        if (!this.skip_autosave_on_destroy) {

            this.perform_save(true);

        }

        this.autosave_session?.destroy?.();

        this.root = null;

        this.deps = null;

        this.form_element_ref = null;

        this.working_metadata = null;

        this.panel_container = null;

        this.mapping_apply = null;

        this.deficiency_apply = null;

        this.autosave_session = null;

        this.draft_taxonomy = null;

    }

}


