/**
 * @fileoverview Hub med länkar till Klassificeringar-delarna i regelfilsredigering.
 */
import '../audit_settings_view_component.css';
import {
    CLASSIFICATION_PARTS,
    type ClassificationPartId,
    classification_part_opens_directly_in_edit,
    get_classification_part_desc_key,
    get_classification_part_title_key,
} from './rulefile_classifications_parts.js';
import { create_rulefile_classifications_back_row } from './rulefile_classifications_nav.js';

export type ClassificationsHubDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    Translation: { t: (key: string) => string };
    router: (view: string, params?: Record<string, string>) => void;
};

export function render_rulefile_classifications_hub(
    deps: ClassificationsHubDeps,
    section: HTMLElement
): void {
    const { Helpers, Translation: { t }, router } = deps;

    section.appendChild(
        Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_classifications_hub_intro'),
        })
    );

    const nav = Helpers.create_element('nav', {
        class_name: 'audit-settings__hub-nav',
        attributes: { 'aria-labelledby': 'rulefile-classifications-hub-heading' },
    });
    nav.appendChild(
        Helpers.create_element('h2', {
            attributes: { id: 'rulefile-classifications-hub-heading' },
            class_name: 'sr-only',
            text_content: t('rulefile_classifications_hub_nav_heading'),
        })
    );

    const list = Helpers.create_element('ul', { class_name: 'audit-settings__hub-list' });
    CLASSIFICATION_PARTS.forEach((part) => {
        list.appendChild(create_hub_item(deps, part));
    });
    nav.appendChild(list);
    section.appendChild(nav);
}

function create_hub_item(deps: ClassificationsHubDeps, part: ClassificationPartId): HTMLElement {
    const { Helpers, Translation: { t }, router } = deps;
    const item = Helpers.create_element('li', { class_name: 'audit-settings__hub-item' });
    const link = Helpers.create_element('a', {
        class_name: 'audit-settings__hub-link',
        attributes: { href: '#' },
        text_content: t(get_classification_part_title_key(part)),
    });
    link.addEventListener('click', (event) => {
        event.preventDefault();
        const params: Record<string, string> = { section: 'classifications', part };
        if (classification_part_opens_directly_in_edit(part)) {
            params.edit = 'true';
        }
        router('rulefile_sections', params);
    });
    item.appendChild(link);
    item.appendChild(
        Helpers.create_element('p', {
            class_name: 'audit-settings__hub-link-desc',
            text_content: t(get_classification_part_desc_key(part)),
        })
    );
    return item;
}

export function create_classification_subpage_back_row(
    deps: ClassificationsHubDeps,
    on_click?: () => void
): HTMLElement {
    return create_rulefile_classifications_back_row(deps, on_click);
}
