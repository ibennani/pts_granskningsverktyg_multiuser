/**
 * @fileoverview Sökfält och accordion för sekundära filter i granskningslistan.
 */

import { count_secondary_filters, type AuditListFilterContext } from '../../logic/audit_list_section_filter.js';
import { create_audit_filter_toggle_button, update_audit_filter_toggle_button } from './audit_filter_toggle_button.js';
import {
    EXPANDABLE_PANEL_EXPANDED_CLASS,
    animate_expandable_panel,
    apply_instant_expanded_panel_state
} from '../../utils/expandable_panel_transition.js';

export const AUDIT_FILTER_ACCORDION_PANEL_ID = 'audit-filter-accordion-panel';

/** Accordion-animation: 0,25 s (övriga expandable-paneler behåller 0,5 s). */
export const AUDIT_FILTER_ACCORDION_TRANSITION_MS = 250;

type MountSecondaryFn = (panel_inner: HTMLElement) => void;

type AuditFilterAccordionCtx = {
    audits?: AuditListFilterContext['audits'];
    audit_filter_query?: string;
    audit_filter_panel_open?: boolean;
    audit_type_filter?: string;
    granskningstyp_filter?: string;
    audit_list_group_mode?: string;
    audit_table_page_size?: string;
    get_t_func: () => (key: string, params?: Record<string, string | number>) => string;
    Helpers: {
        create_element: (
            tag: string,
            opts?: {
                class_name?: string | string[];
                text_content?: string;
                attributes?: Record<string, string>;
            }
        ) => HTMLElement;
    };
    handle_filter_input: (event: Event) => void;
    _auditFilterInputRef?: HTMLInputElement | null;
    _auditFilterToggleRef?: HTMLButtonElement | null;
    _auditFilterWrapperRef?: HTMLElement | null;
    _auditFilterAccordionSection?: HTMLElement | null;
    _auditFilterPanelHost?: HTMLElement | null;
    _auditFilterExpandablePanel?: HTMLElement | null;
    _auditFilterPanelInner?: HTMLElement | null;
    _auditTypeSelectRef?: HTMLSelectElement | null;
    _granskningstypSelectRef?: HTMLSelectElement | null;
    _auditPageSizeSelectRef?: HTMLSelectElement | null;
    _auditGroupByCaseSelectRef?: HTMLSelectElement | null;
    _auditFilterResetRef?: HTMLButtonElement | null;
};

function to_filter_count_ctx(ctx: AuditFilterAccordionCtx): AuditListFilterContext {
    return {
        audits: ctx.audits ?? [],
        audit_filter_query: ctx.audit_filter_query,
        audit_type_filter: ctx.audit_type_filter,
        granskningstyp_filter: ctx.granskningstyp_filter,
        audit_list_group_mode: ctx.audit_list_group_mode,
        audit_table_page_size: ctx.audit_table_page_size
    };
}

function render_search_field(ctx: AuditFilterAccordionCtx): HTMLElement {
    const t = ctx.get_t_func();
    const search_row = ctx.Helpers.create_element('div', {
        class_name: ['audit-filter-search-row', 'form-group']
    });
    const text_field = ctx.Helpers.create_element('div', {
        class_name: ['audit-filter-row__field', 'audit-filter-row__field--text']
    });
    const filter_label = ctx.Helpers.create_element('label', {
        attributes: { for: 'audit-filter-input' }
    });
    filter_label.appendChild(
        ctx.Helpers.create_element('strong', { text_content: t('audit_filter_label') })
    );
    const filter_input = ctx.Helpers.create_element('input', {
        class_name: ['audit-filter-input', 'form-control'],
        attributes: {
            id: 'audit-filter-input',
            type: 'text',
            name: 'audit-filter',
            value: ctx.audit_filter_query || ''
        }
    }) as HTMLInputElement;
    filter_input.addEventListener('input', ctx.handle_filter_input);
    ctx._auditFilterInputRef = filter_input;
    text_field.appendChild(filter_label);
    text_field.appendChild(filter_input);
    search_row.appendChild(text_field);
    return search_row;
}

function build_accordion_shell(
    ctx: AuditFilterAccordionCtx,
    wrapper: HTMLElement,
    secondary_count: number,
    panel_open: boolean
): HTMLElement {
    const t = ctx.get_t_func();
    const section = ctx.Helpers.create_element('div', {
        class_name: 'audit-filter-accordion'
    });
    section.appendChild(
        create_audit_filter_toggle_button(ctx, wrapper, secondary_count, panel_open)
    );

    const panel_host = ctx.Helpers.create_element('div', {
        class_name: 'audit-filter-accordion__panel-host',
        attributes: {
            id: AUDIT_FILTER_ACCORDION_PANEL_ID,
            role: 'region',
            'aria-label': t('audit_filter_secondary_region_label')
        }
    });
    panel_host.hidden = !panel_open;

    const expandable_panel = ctx.Helpers.create_element('div', {
        class_name: ['expandable-panel', 'audit-filter-accordion__panel']
    });
    const panel_inner = ctx.Helpers.create_element('div', {
        class_name: ['expandable-panel__inner', 'audit-filter-accordion__panel-inner']
    });
    expandable_panel.appendChild(panel_inner);
    panel_host.appendChild(expandable_panel);
    section.appendChild(panel_host);

    ctx._auditFilterAccordionSection = section;
    ctx._auditFilterPanelHost = panel_host;
    ctx._auditFilterExpandablePanel = expandable_panel;
    ctx._auditFilterPanelInner = panel_inner;
    return section;
}

/** Tömmer accordion-panelen och nollställer referenser till sekundära fält. */
export function unmount_audit_filter_panel_content(ctx: AuditFilterAccordionCtx): void {
    ctx._auditFilterPanelInner?.replaceChildren();
    ctx._auditTypeSelectRef = null;
    ctx._granskningstypSelectRef = null;
    ctx._auditPageSizeSelectRef = null;
    ctx._auditGroupByCaseSelectRef = null;
    ctx._auditFilterResetRef = null;
}

/** Uppdaterar accordion-knappens text och badge utan omrendering av hela headern. */
export function update_audit_filter_accordion_ui(ctx: AuditFilterAccordionCtx): void {
    const secondary_count = count_secondary_filters(to_filter_count_ctx(ctx));
    const panel_open = Boolean(ctx.audit_filter_panel_open);
    if (ctx._auditFilterToggleRef) {
        update_audit_filter_toggle_button(ctx._auditFilterToggleRef, ctx, secondary_count, panel_open);
    }
}

async function run_accordion_animation(
    ctx: AuditFilterAccordionCtx,
    expand: boolean,
    mount_secondary: MountSecondaryFn
): Promise<void> {
    const section = ctx._auditFilterAccordionSection;
    const panel_host = ctx._auditFilterPanelHost;
    const expandable_panel = ctx._auditFilterExpandablePanel;
    const panel_inner = ctx._auditFilterPanelInner;
    const toggle = ctx._auditFilterToggleRef;
    if (!section || !panel_host || !expandable_panel || !panel_inner || !toggle) return;
    if (section.getAttribute('data-animating') === 'true') return;

    section.setAttribute('data-animating', 'true');
    try {
        if (expand) {
            mount_secondary(panel_inner);
            section.classList.add('audit-filter-accordion--open');
            ctx._auditFilterWrapperRef?.classList.add('audit-filter-wrapper--open');
            toggle.setAttribute('aria-expanded', 'true');
            update_audit_filter_accordion_ui(ctx);
            await animate_expandable_panel(
                expandable_panel,
                panel_host,
                true,
                EXPANDABLE_PANEL_EXPANDED_CLASS,
                AUDIT_FILTER_ACCORDION_TRANSITION_MS
            );
            return;
        }

        section.classList.remove('audit-filter-accordion--open');
        ctx._auditFilterWrapperRef?.classList.remove('audit-filter-wrapper--open');
        toggle.setAttribute('aria-expanded', 'false');
        update_audit_filter_accordion_ui(ctx);
        await animate_expandable_panel(
            expandable_panel,
            panel_host,
            false,
            EXPANDABLE_PANEL_EXPANDED_CLASS,
            AUDIT_FILTER_ACCORDION_TRANSITION_MS
        );
        unmount_audit_filter_panel_content(ctx);
    } finally {
        section.removeAttribute('data-animating');
    }
}

/** Öppnar eller stänger filteraccordion med animation och lazy mount/unmount. */
export async function toggle_audit_filter_accordion(
    ctx: AuditFilterAccordionCtx,
    mount_secondary: MountSecondaryFn
): Promise<boolean> {
    const will_open = !ctx.audit_filter_panel_open;
    ctx.audit_filter_panel_open = will_open;
    await run_accordion_animation(ctx, will_open, mount_secondary);
    return will_open;
}

/** Stänger accordion (t.ex. vid Escape) med animation. */
export async function close_audit_filter_accordion(
    ctx: AuditFilterAccordionCtx,
    mount_secondary: MountSecondaryFn
): Promise<void> {
    if (!ctx.audit_filter_panel_open) return;
    ctx.audit_filter_panel_open = false;
    await run_accordion_animation(ctx, false, mount_secondary);
}

/**
 * Bygger sökfält och filteraccordion under det.
 */
export function render_audit_filter_search_and_accordion(
    ctx: AuditFilterAccordionCtx,
    wrapper: HTMLElement,
    mount_secondary: MountSecondaryFn
): HTMLElement {
    const secondary_count = count_secondary_filters(to_filter_count_ctx(ctx));
    const panel_open = Boolean(ctx.audit_filter_panel_open);
    ctx._auditFilterWrapperRef = wrapper;

    const container = ctx.Helpers.create_element('div', {
        class_name: 'audit-filter-search-accordion'
    });
    container.appendChild(render_search_field(ctx));

    const accordion = build_accordion_shell(ctx, wrapper, secondary_count, panel_open);
    container.appendChild(accordion);

    if (panel_open) {
        accordion.classList.add('audit-filter-accordion--open');
        wrapper.classList.add('audit-filter-wrapper--open');
        mount_secondary(ctx._auditFilterPanelInner as HTMLElement);
        apply_instant_expanded_panel_state(
            ctx._auditFilterExpandablePanel as HTMLElement,
            ctx._auditFilterPanelHost as HTMLElement,
            true,
            EXPANDABLE_PANEL_EXPANDED_CLASS
        );
    }

    return container;
}
