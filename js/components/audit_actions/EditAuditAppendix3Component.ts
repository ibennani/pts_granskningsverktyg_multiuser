/**
 * @fileoverview Redigerar Bilaga 3 introtext för aktuell granskning (samma formulär som regelfil).
 */
import { build_appendix3_override_payload } from '../../logic/audit_appendix_overrides.js';
import { resolve_appendix3_screenshots_template } from '../../logic/appendix3_screenshots_template.js';
import { sync_to_server_now } from '../../logic/server_sync.js';
import { build_save_button_html_content } from '../../ui/save_button_html.js';

type Deps = {
    router: (view: string, params?: Record<string, string>) => void;
    getState: () => Record<string, unknown>;
    dispatch: (action: unknown) => Promise<void> | void;
    StoreActionTypes: { UPDATE_METADATA: string };
    Translation: { t: (key: string) => string };
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    NotificationComponent: { show_global_message: (msg: string, type: string) => void };
};

export class EditAuditAppendix3Component {
    private root: HTMLElement | null = null;
    private deps: Deps | null = null;
    private intro_textarea: HTMLTextAreaElement | null = null;

    async init({ root, deps }: { root: HTMLElement; deps: Deps }): Promise<void> {
        this.root = root;
        this.deps = deps;
    }

    private navigate_back_to_view(): void {
        this.deps?.router('audit_actions', { section: 'appendix_templates', appendix: '3' });
    }

    private async save_template(): Promise<void> {
        if (!this.root || !this.deps) return;
        const intro_text = this.intro_textarea?.value ?? '';

        await this.deps.dispatch({
            type: this.deps.StoreActionTypes.UPDATE_METADATA,
            payload: { ...build_appendix3_override_payload(intro_text), skip_render: true },
        });

        try {
            await sync_to_server_now(this.deps.getState, this.deps.dispatch);
        } catch {
            // Fel visas av sync
        }

        this.deps.NotificationComponent.show_global_message(
            this.deps.Translation.t('audit_appendix_3_saved'),
            'success'
        );
    }

    render(): void {
        if (!this.root || !this.deps) return;
        this.root.innerHTML = '';

        const { Helpers: helpers, Translation: { t } } = this.deps;
        const template = resolve_appendix3_screenshots_template(this.deps.getState());

        const intro_field = helpers.create_element('div', { class_name: 'form-group' });
        intro_field.appendChild(
            helpers.create_element('label', {
                attributes: { for: 'audit-appendix3-intro-text' },
                text_content: t('rulefile_appendix3_intro_label'),
            })
        );
        const intro_textarea = helpers.create_element('textarea', {
            class_name: 'form-control',
            attributes: {
                id: 'audit-appendix3-intro-text',
                rows: '16',
            },
        }) as HTMLTextAreaElement;
        intro_textarea.value = template.introText;
        this.intro_textarea = intro_textarea;
        intro_field.appendChild(intro_textarea);
        this.root.appendChild(intro_field);

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
    }

    destroy(): void {
        this.root = null;
        this.deps = null;
        this.intro_textarea = null;
    }
}
