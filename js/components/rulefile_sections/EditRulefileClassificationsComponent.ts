/**
 * @fileoverview Redigerar regelfilens klassificeringar: taxonomier och kravkoppling.
 */
import { clone_metadata, ensure_metadata_defaults } from '../../logic/rulefile_metadata_model.js';
import { flush_rulefile_editing_sync_if_active } from '../../logic/server_sync.js';
import { normalize_rulefile_metadata_vocabularies } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';
import { render_taxonomies_editor } from './rulefile_taxonomies_editor_ui.js';
import { render_requirement_mapping_ui } from './rulefile_requirement_mapping_ui.js';
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
};

type TabId = 'taxonomies' | 'mapping';

export class EditRulefileClassificationsComponent {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private form_element_ref: HTMLFormElement | null = null;
    private working_metadata: Record<string, unknown> | null = null;
    private active_tab: TabId = 'taxonomies';
    private taxonomies_container: HTMLElement | null = null;
    private mapping_container: HTMLElement | null = null;
    private mapping_apply: (() => Record<string, unknown>) | null = null;
    private mapping_rendered = false;
    private autosave_session: { request_autosave?: () => void; destroy?: () => void } | null = null;
    skip_autosave_on_destroy = false;

    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.root = root;
        this.deps = deps;
        this.form_element_ref = null;
        this.working_metadata = null;
        this.active_tab = 'taxonomies';
        this.mapping_apply = null;
        this.mapping_rendered = false;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
    }

    private get_editor_ctx() {
        if (!this.deps) throw new Error('Missing deps');
        return { Helpers: this.deps.Helpers, Translation: this.deps.Translation };
    }

    private ensure_working_metadata(): Record<string, unknown> {
        if (this.working_metadata) return this.working_metadata;
        const state = this.deps?.getState() ?? {};
        const base = ((state.ruleFileContent as Record<string, unknown> | undefined)?.metadata ??
            {}) as Record<string, unknown>;
        this.working_metadata = ensure_metadata_defaults(clone_metadata(base)) as Record<string, unknown>;
        return this.working_metadata;
    }

    private build_updated_rulefile(skip_render: boolean): Record<string, unknown> {
        const state = this.deps!.getState();
        const current = (state.ruleFileContent as Record<string, unknown>) || {};
        const working = this.ensure_working_metadata();
        const normalized_metadata = normalize_rulefile_metadata_vocabularies({ ...working }, { mode: 'read' });
        let next_rulefile: Record<string, unknown> = {
            ...current,
            metadata: { ...(current.metadata as object), ...normalized_metadata },
        };
        if (this.mapping_apply) {
            next_rulefile = this.mapping_apply();
            next_rulefile.metadata = { ...(next_rulefile.metadata as object), ...normalized_metadata };
        }
        this.dispatch_save(next_rulefile, skip_render);
        return next_rulefile;
    }

    private dispatch_save(rule_file_content: Record<string, unknown>, skip_render: boolean): void {
        this.deps?.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: rule_file_content, skip_render },
        });
    }

    private handle_autosave_input = (): void => {
        this.autosave_session?.request_autosave?.();
    };

    private perform_save(skip_render: boolean): void {
        this.build_updated_rulefile(skip_render);
    }

    private render_taxonomies_panel(): void {
        if (!this.taxonomies_container || !this.deps) return;
        render_taxonomies_editor(this.get_editor_ctx(), this.taxonomies_container, this.ensure_working_metadata(), {
            on_change: this.handle_autosave_input,
        });
    }

    private render_mapping_panel(): void {
        if (!this.mapping_container || !this.deps || this.mapping_rendered) return;
        const state = this.deps.getState();
        const rule_file = (state.ruleFileContent as Record<string, unknown>) || {};
        const mapping = render_requirement_mapping_ui(
            this.get_editor_ctx(),
            this.mapping_container,
            { ...rule_file, metadata: this.ensure_working_metadata() },
            this.handle_autosave_input
        );
        this.mapping_apply = mapping.apply_changes;
        this.mapping_rendered = true;
    }

    private ensure_tab_panel_rendered(tab_id: TabId): void {
        if (tab_id === 'taxonomies') {
            this.render_taxonomies_panel();
            return;
        }
        this.render_mapping_panel();
    }

    private render_tab_panels(): void {
        this.ensure_tab_panel_rendered(this.active_tab);
    }

    private set_active_tab(tab_id: TabId, button: HTMLButtonElement): void {
        if (!this.form_element_ref || !this.deps) return;
        this.active_tab = tab_id;
        this.form_element_ref.querySelectorAll('[data-classifications-tab]').forEach((el) => {
            const is_active = el.getAttribute('data-classifications-tab') === tab_id;
            el.classList.toggle('is-active', is_active);
            if (el.matches('[role="tab"]')) {
                el.setAttribute('aria-selected', is_active ? 'true' : 'false');
                (el as HTMLElement).tabIndex = is_active ? 0 : -1;
            }
            if (el.matches('[role="tabpanel"]')) {
                (el as HTMLElement).hidden = !is_active;
            }
        });
        this.ensure_tab_panel_rendered(tab_id);
        button.focus();
    }

    private create_tab_button(tab_id: TabId, label_key: string, panel_id: string): HTMLButtonElement {
        const t = this.deps!.Translation.t;
        const is_active = this.active_tab === tab_id;
        const button = this.deps!.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'classifications-tab-button', ...(is_active ? ['is-active'] : [])],
            attributes: {
                type: 'button',
                role: 'tab',
                id: `classifications-tab-${tab_id}`,
                'aria-controls': panel_id,
                'aria-selected': is_active ? 'true' : 'false',
                tabindex: is_active ? '0' : '-1',
                'data-classifications-tab': tab_id,
            },
            text_content: t(label_key),
        }) as HTMLButtonElement;
        button.addEventListener('click', () => this.set_active_tab(tab_id, button));
        return button;
    }

    private navigate_back_to_view(): void {
        this.deps?.router('rulefile_sections', { section: 'classifications' });
    }

    private async save_and_sync(): Promise<void> {
        if (!this.deps) return;
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
        this.navigate_back_to_view();
    }

    private create_tab_panel_attributes(tab_id: TabId, panel_id: string, labelled_by: string): Record<string, string> {
        const attributes: Record<string, string> = {
            role: 'tabpanel',
            id: panel_id,
            'aria-labelledby': labelled_by,
            'data-classifications-tab': tab_id,
        };
        if (this.active_tab !== tab_id) {
            attributes.hidden = 'hidden';
        }
        return attributes;
    }

    render(): void {
        if (!this.root || !this.deps) return;
        this.root.innerHTML = '';
        const t = this.deps.Translation.t;
        this.ensure_working_metadata();

        const form = this.deps.Helpers.create_element('form', {
            class_name: 'rulefile-classifications-edit-form',
        }) as HTMLFormElement;
        this.form_element_ref = form;

        const tablist = this.deps.Helpers.create_element('div', {
            class_name: 'classifications-tablist',
            attributes: { role: 'tablist', 'aria-label': t('rulefile_classifications_tablist_label') },
        });
        const taxonomies_panel_id = 'classifications-panel-taxonomies';
        const mapping_panel_id = 'classifications-panel-mapping';
        tablist.append(
            this.create_tab_button('taxonomies', 'rulefile_classifications_tab_taxonomies', taxonomies_panel_id),
            this.create_tab_button('mapping', 'rulefile_classifications_tab_mapping', mapping_panel_id)
        );
        form.appendChild(tablist);

        const taxonomies_panel = this.deps.Helpers.create_element('section', {
            class_name: 'classifications-tab-panel',
            attributes: this.create_tab_panel_attributes(
                'taxonomies',
                taxonomies_panel_id,
                'classifications-tab-taxonomies'
            ),
        });
        taxonomies_panel.appendChild(
            this.deps.Helpers.create_element('p', {
                class_name: 'field-hint',
                text_content: t('rulefile_classifications_taxonomies_intro'),
            })
        );
        this.taxonomies_container = this.deps.Helpers.create_element('div', {
            class_name: 'taxonomies-editor',
        });
        taxonomies_panel.appendChild(this.taxonomies_container);
        form.appendChild(taxonomies_panel);

        const mapping_panel = this.deps.Helpers.create_element('section', {
            class_name: 'classifications-tab-panel',
            attributes: this.create_tab_panel_attributes(
                'mapping',
                mapping_panel_id,
                'classifications-tab-mapping'
            ),
        });
        this.mapping_container = this.deps.Helpers.create_element('div', {
            class_name: 'requirement-mapping-editor',
        });
        mapping_panel.appendChild(this.mapping_container);
        form.appendChild(mapping_panel);

        const actions = this.deps.Helpers.create_element('div', { class_name: 'form-actions' });
        const save_button = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'submit' },
            html_content: build_save_button_html_content(t('save_changes_button')),
        });
        const back_button = this.deps.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            text_content: t('rulefile_info_blocks_back_to_view'),
        });
        back_button.addEventListener('click', () => this.navigate_back_to_view());
        actions.append(save_button, back_button);
        form.appendChild(actions);

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            void this.save_and_sync();
        });

        this.root.appendChild(form);
        this.render_tab_panels();

        if (this.deps.AutosaveService?.create_session) {
            this.autosave_session = this.deps.AutosaveService.create_session({
                save: () => this.perform_save(true),
            });
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
        this.taxonomies_container = null;
        this.mapping_container = null;
        this.mapping_apply = null;
        this.mapping_rendered = false;
        this.autosave_session = null;
    }
}
