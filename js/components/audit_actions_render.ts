/**
 * @fileoverview Renderhjälp för Åtgärder-vyn (hub och undersidor).
 */

export type AuditActionsSection =
    | ''
    | 'manage'
    | 'downloads'
    | 'snapshots'
    | 'information'
    | 'appendix_templates';

export type AuditActionsRenderDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
    router: (view: string, params?: Record<string, string>) => void;
};

export function normalize_audit_actions_section(raw: unknown): AuditActionsSection {
    if (
        raw === 'manage'
        || raw === 'downloads'
        || raw === 'snapshots'
        || raw === 'information'
        || raw === 'appendix_templates'
    ) {
        return raw;
    }
    if (raw === 'hub') return '';
    return '';
}

export function render_audit_actions_hub(deps: AuditActionsRenderDeps, plate: HTMLElement): void {
    const { Helpers: helpers, Translation: { t }, router } = deps;

    plate.appendChild(helpers.create_element('h1', { text_content: t('audit_actions_title') }));
    plate.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('audit_actions_hub_intro'),
        })
    );

    const nav = helpers.create_element('nav', {
        class_name: 'audit-settings__hub-nav',
        attributes: { 'aria-label': t('audit_actions_hub_nav_heading') },
    });

    const list = helpers.create_element('ul', { class_name: 'audit-settings__hub-list' });
    const add_hub_link = (
        section: Exclude<AuditActionsSection, ''>,
        label_key: string,
        desc_key: string
    ) => {
        const item = helpers.create_element('li', { class_name: 'audit-settings__hub-item' });
        const link = helpers.create_element('a', {
            class_name: 'audit-settings__hub-link',
            attributes: { href: '#' },
            text_content: t(label_key),
        });
        link.addEventListener('click', (event) => {
            event.preventDefault();
            router('audit_actions', { section });
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

    add_hub_link('manage', 'audit_actions_nav_manage', 'audit_actions_hub_manage_desc');
    add_hub_link('downloads', 'audit_actions_nav_downloads', 'audit_actions_hub_downloads_desc');
    add_hub_link('information', 'audit_actions_nav_information', 'audit_actions_hub_information_desc');
    add_hub_link(
        'appendix_templates',
        'audit_actions_nav_appendix_templates',
        'audit_actions_hub_appendix_templates_desc'
    );
    add_hub_link('snapshots', 'audit_actions_nav_snapshots', 'audit_actions_hub_snapshots_desc');
    nav.appendChild(list);
    plate.appendChild(nav);
}

/** Sidhuvud för Snapshots (endast rubrik tills innehåll läggs till). */
export function render_audit_actions_snapshots_header(
    deps: AuditActionsRenderDeps,
    plate: HTMLElement
): void {
    const { Helpers: helpers, Translation: { t } } = deps;

    plate.appendChild(helpers.create_element('h1', { text_content: t('audit_actions_snapshots_title') }));
}

/** Sidhuvud för undersida (Hantera eller Bilagor och exportfunktioner). */
export function render_audit_actions_section_header(
    deps: AuditActionsRenderDeps,
    plate: HTMLElement,
    options: {
        title_key: string;
        intro_key: string;
        heading_id?: string;
        page_header_action?: HTMLElement;
    }
): void {
    const { Helpers: helpers, Translation: { t } } = deps;

    const page_header = helpers.create_element('div', {
        class_name: 'audit-settings__page-header-row',
    });
    const heading_attrs: Record<string, string> = {};
    if (options.heading_id) {
        heading_attrs.id = options.heading_id;
    }
    page_header.appendChild(
        helpers.create_element('h1', {
            attributes: heading_attrs,
            text_content: t(options.title_key),
        })
    );
    if (options.page_header_action) {
        page_header.appendChild(options.page_header_action);
    }
    plate.appendChild(page_header);

    plate.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t(options.intro_key),
        })
    );
}
