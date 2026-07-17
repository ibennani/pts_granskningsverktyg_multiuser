/**
 * @fileoverview Renderhjälp för Inställningar-vyn (hub och undersidor).
 */
import { MetadataFormComponent } from './MetadataFormComponent.js';
import { type MarkdownPreviewEditorHost } from '../utils/markdown_preview_editor_ui.js';
import { resolve_appendix1_sections } from '../logic/appendix1_summary_text.js';
import { render_appendix1_summary_editor_page } from '../utils/appendix1_summary_editor_render.js';

export type AuditSettingsSection = '' | 'information' | 'summary' | 'principle_intros';

/** Var användaren ska återvända från en inställningsundersida. */
export type AuditSettingsReturnTo = 'overview' | 'settings';

export type AuditSettingsRenderDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router: (view: string, params?: Record<string, string>) => void;
};

type AuditSettingsFormHandlers = {
    on_metadata_submit: (form_data: Record<string, unknown>) => void | Promise<void>;
    on_back: () => void;
    on_summary_save: (text: string) => void | Promise<void>;
};

export function normalize_audit_settings_return_to(raw: unknown): AuditSettingsReturnTo {
    if (raw === 'overview') return 'overview';
    return 'settings';
}

export function audit_settings_back_label_key(return_to: AuditSettingsReturnTo): string {
    return return_to === 'overview'
        ? 'audit_settings_back_to_overview'
        : 'audit_settings_back_to_hub';
}

function create_back_row(
    helpers: AuditSettingsRenderDeps['Helpers'],
    t: (key: string) => string,
    label_key: string,
    on_click: () => void
): HTMLElement {
    const row = helpers.create_element('div', { class_name: 'audit-settings__back-row' });
    const btn = helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t(label_key),
    });
    btn.addEventListener('click', on_click);
    row.appendChild(btn);
    return row;
}

/** Hub med länkar till de två inställningssidorna. */
export function render_audit_settings_hub(
    deps: AuditSettingsRenderDeps,
    plate: HTMLElement
): void {
    const { Helpers: helpers, Translation: { t }, router } = deps;

    plate.appendChild(helpers.create_element('h1', { text_content: t('audit_settings_title') }));
    plate.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('audit_settings_hub_intro'),
        })
    );

    const nav = helpers.create_element('nav', {
        class_name: 'audit-settings__hub-nav',
        attributes: { 'aria-labelledby': 'audit-settings-hub-heading' },
    });
    nav.appendChild(
        helpers.create_element('h2', {
            attributes: { id: 'audit-settings-hub-heading' },
            class_name: 'sr-only',
            text_content: t('audit_settings_hub_nav_heading'),
        })
    );

    const list = helpers.create_element('ul', { class_name: 'audit-settings__hub-list' });
    const add_hub_link = (section: 'information' | 'summary' | 'principle_intros', label_key: string, desc_key: string) => {
        const item = helpers.create_element('li', { class_name: 'audit-settings__hub-item' });
        const link = helpers.create_element('a', {
            class_name: 'audit-settings__hub-link',
            attributes: { href: '#' },
            text_content: t(label_key),
        });
        link.addEventListener('click', (event) => {
            event.preventDefault();
            router('audit_settings', { section, returnTo: 'settings' });
        });
        item.appendChild(link);
        item.appendChild(
            helpers.create_element('p', {
                class_name: 'audit-settings__hub-link-desc',
                text_content: t(desc_key),
            })
        );
        list.appendChild(item);
    };

    add_hub_link('information', 'audit_settings_nav_information', 'audit_settings_hub_information_desc');
    add_hub_link('summary', 'audit_settings_nav_summary', 'audit_settings_hub_summary_desc');
    add_hub_link('principle_intros', 'audit_settings_nav_principle_intros', 'audit_settings_hub_principle_intros_desc');
    nav.appendChild(list);
    plate.appendChild(nav);

    plate.appendChild(
        create_back_row(helpers, t, 'audit_settings_back_to_overview', () => router('audit_overview'))
    );
}

/** Undersida: granskningsinformation (metadata). */
export function render_audit_settings_information_section(
    deps: AuditSettingsRenderDeps,
    plate: HTMLElement,
    options: {
        state: Record<string, unknown>;
        readonly: boolean;
        status: string;
        metadata_container_ref: { current: HTMLElement | null };
        full_deps: Record<string, unknown>;
        return_to: AuditSettingsReturnTo;
        handlers: AuditSettingsFormHandlers;
    }
): void {
    const { Helpers: helpers, Translation: { t } } = deps;
    const { state, readonly, status, metadata_container_ref, full_deps, return_to, handlers } = options;
    const back_label_key = audit_settings_back_label_key(return_to);

    plate.appendChild(
        helpers.create_element('h1', { text_content: t('audit_settings_nav_information') })
    );
    plate.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('audit_settings_information_intro'),
        })
    );

    const metadata_section = helpers.create_element('section', {
        class_name: 'audit-settings__metadata-section',
    });

    if (readonly) {
        const md = (state.auditMetadata || {}) as Record<string, string>;
        const readonly_list = helpers.create_element('dl', {
            class_name: 'audit-settings__readonly-metadata',
        });
        const add_row = (label_key: string, value: string) => {
            if (!value) return;
            readonly_list.appendChild(helpers.create_element('dt', { text_content: t(label_key) }));
            readonly_list.appendChild(helpers.create_element('dd', { text_content: value }));
        };
        add_row('case_number', md.caseNumber || '');
        add_row('actor_name', md.actorName || '');
        add_row('actor_link', md.actorLink || '');
        add_row('auditor_name', md.auditorName || '');
        add_row('case_handler', md.caseHandler || '');
        metadata_section.appendChild(readonly_list);
    } else {
        metadata_container_ref.current = helpers.create_element('div', {
            id: 'audit-settings-metadata-form',
        });
        metadata_section.appendChild(metadata_container_ref.current);

        MetadataFormComponent.init({
            root: metadata_container_ref.current,
            deps: full_deps,
            options: {
                onSubmit: handlers.on_metadata_submit,
                onCancel: handlers.on_back,
            },
        });

        const md = (state.auditMetadata || {}) as Record<string, string>;
        MetadataFormComponent.render({
            initialData: md,
            submitButtonText: t('audit_settings_save_metadata'),
            cancelButtonText: t(back_label_key),
            showStartDate: status === 'in_progress' || status === 'locked' || status === 'archived',
            showEndDate: status === 'locked' || status === 'archived',
            effectiveStartIso: (state.startTime as string) || md.startTime || null,
        });
    }

    plate.appendChild(metadata_section);
}

/** Undersida: Bilaga 1-sammanfattningstext. */
export function render_audit_settings_summary_section(
    deps: AuditSettingsRenderDeps,
    plate: HTMLElement,
    options: {
        state: Record<string, unknown>;
        readonly: boolean;
        summary_host: MarkdownPreviewEditorHost;
        return_to: AuditSettingsReturnTo;
        handlers: Pick<AuditSettingsFormHandlers, 'on_summary_save' | 'on_back'>;
    }
): void {
    const { Helpers: helpers } = deps;
    const { state, readonly, summary_host, return_to, handlers } = options;
    const back_label_key = audit_settings_back_label_key(return_to);

    render_appendix1_summary_editor_page(
        { Helpers: helpers, Translation: deps.Translation },
        plate,
        {
            heading_id: 'audit-settings-appendix1-heading',
            heading_key: 'audit_settings_appendix1_heading',
            intro_key: 'audit_settings_summary_intro',
            label_key: 'audit_settings_appendix1_label',
            textarea_id: 'audit-settings-appendix1-summary-text',
            initial_text: resolve_appendix1_sections(state).introduction?.content ?? '',
            readonly,
            summary_host,
            back_button_key: back_label_key,
            on_save: (text) => handlers.on_summary_save(text),
            on_discard: handlers.on_back,
            on_back: handlers.on_back,
        }
    );
}

export function normalize_audit_settings_section(raw: unknown): AuditSettingsSection {
    if (raw === 'information' || raw === 'summary' || raw === 'principle_intros') return raw;
    return '';
}
