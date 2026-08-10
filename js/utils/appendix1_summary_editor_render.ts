/**
 * @fileoverview Delad sidlayout för Bilaga 1-sammanfattningseditor (granskning och regelfil).
 */
import '../components/audit_settings_view_component.css';

import {
    build_markdown_preview_editor_ui,
    type MarkdownPreviewEditorHost,
} from './markdown_preview_editor_ui.js';

export type Appendix1SummaryEditorRenderDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    Translation: { t: (key: string) => string };
};

export type Appendix1SummaryEditorPageOptions = {
    heading_id: string;
    heading_key: string;
    intro_key: string;
    label_key: string;
    textarea_id: string;
    initial_text: string;
    readonly?: boolean;
    summary_host: MarkdownPreviewEditorHost;
    back_button_key?: string;
    on_save: (text: string) => void | Promise<void>;
    on_back?: () => void;
    on_discard?: () => void;
    /** Knapp eller annan kontroll som placeras i sidhuvudsraden efter rubriken. */
    page_header_action?: HTMLElement;
};

/**
 * Renderar Bilaga 1-sammanfattningssida med samma layout som Inställningar i granskning.
 */
export function render_appendix1_summary_editor_page(
    deps: Appendix1SummaryEditorRenderDeps,
    container: HTMLElement,
    options: Appendix1SummaryEditorPageOptions
): void {
    const { Helpers: helpers, Translation } = deps;
    const t = Translation.t;

    const page_header = helpers.create_element('div', {
        class_name: 'audit-settings__page-header-row',
    });
    page_header.appendChild(
        helpers.create_element('h1', {
            attributes: { id: options.heading_id },
            text_content: t(options.heading_key),
        })
    );
    if (options.page_header_action) {
        page_header.appendChild(options.page_header_action);
    }
    container.appendChild(page_header);

    container.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t(options.intro_key),
        })
    );
    container.appendChild(
        helpers.create_element('hr', {
            class_name: 'audit-settings__section-divider',
            attributes: { 'aria-hidden': 'true' },
        })
    );

    options.summary_host.working_text = options.initial_text;
    options.summary_host.is_editing = false;

    const summary_section = build_markdown_preview_editor_ui(
        { Helpers: helpers, Translation },
        options.summary_host,
        {
            label_key: options.label_key,
            textarea_id: options.textarea_id,
            initial_text: options.initial_text,
            readonly: options.readonly,
            hide_heading: true,
            external_edit_button_container: options.readonly ? undefined : page_header,
            on_save: options.on_save,
            on_discard: options.on_discard,
            on_back: options.on_back,
            back_button_key: options.back_button_key,
        }
    );
    summary_section.classList.add('audit-settings__summary-section');
    container.appendChild(summary_section);
}
