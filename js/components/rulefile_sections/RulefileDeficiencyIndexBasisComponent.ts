/**
 * @fileoverview Inline-redigering av bristindex-underlag per krav (utan separat redigeringsläge).
 */

import { render_deficiency_index_basis_ui } from './rulefile_deficiency_index_basis_ui.js';

type Deps = {
    router: (view: string, params?: Record<string, string>) => void;
    getState: () => Record<string, unknown>;
    dispatch: (action: unknown) => Promise<void> | void;
    StoreActionTypes: { UPDATE_RULEFILE_CONTENT: string };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    AutosaveService?: { create_session?: (opts: unknown) => { request_autosave?: () => void; destroy?: () => void } };
};

export class RulefileDeficiencyIndexBasisComponent {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private panel_container: HTMLElement | null = null;
    private apply_changes: (() => Record<string, unknown>) | null = null;
    private autosave_session: { request_autosave?: () => void; destroy?: () => void } | null = null;
    skip_autosave_on_destroy = false;

    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.root = root;
        this.deps = deps;
        this.panel_container = null;
        this.apply_changes = null;
        this.autosave_session = null;
        this.skip_autosave_on_destroy = false;
    }

    private get_rule_file_content(): Record<string, unknown> {
        const state = this.deps?.getState() ?? {};
        return (state.ruleFileContent as Record<string, unknown>) || {};
    }

    private dispatch_save(rule_file_content: Record<string, unknown>, skip_render: boolean): void {
        this.deps?.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: rule_file_content, skip_render },
        });
    }

    private perform_save(skip_render: boolean): void {
        if (!this.apply_changes) return;
        const current = this.get_rule_file_content();
        const next = this.apply_changes();
        if (next !== current) {
            this.dispatch_save(next, skip_render);
        }
    }

    private handle_autosave_input = (): void => {
        this.autosave_session?.request_autosave?.();
    };

    private render_panel(): void {
        if (!this.panel_container || !this.deps) return;
        this.panel_container.innerHTML = '';
        const ctx = {
            Helpers: this.deps.Helpers,
            Translation: this.deps.Translation,
            router: this.deps.router,
        };
        const result = render_deficiency_index_basis_ui(
            ctx,
            this.panel_container,
            this.get_rule_file_content(),
            this.handle_autosave_input
        );
        this.apply_changes = result.apply_changes;
    }

    render(): void {
        if (!this.root || !this.deps) return;
        const t = this.deps.Translation.t;
        this.root.innerHTML = '';
        this.root.appendChild(
            this.deps.Helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: t('rulefile_classifications_deficiency_index_basis_intro'),
            })
        );
        this.panel_container = this.deps.Helpers.create_element('form', {
            class_name: 'deficiency-index-basis-panel rulefile-classifications-edit-form',
            attributes: { novalidate: 'novalidate' },
        }) as HTMLFormElement;
        this.root.appendChild(this.panel_container);
        this.panel_container.addEventListener('submit', (event) => {
            event.preventDefault();
        });
        this.render_panel();

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
        this.panel_container = null;
        this.apply_changes = null;
        this.autosave_session = null;
    }
}
