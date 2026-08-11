/**
 * @fileoverview Hub och undersidor för Bilagornas malltexter i regelfilsredigering.
 */
import '../audit_settings_view_component.css';

export type RulefileAppendixTemplatesRenderDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        get_icon_svg?: (name: string) => string;
    };
    Translation: { t: (key: string) => string };
    router: (view: string, params?: Record<string, string>) => void;
};

/** Hub med länkar till Bilaga 1–3. */
export function render_rulefile_appendix_templates_hub(
    deps: RulefileAppendixTemplatesRenderDeps,
    section: HTMLElement
): void {
    const { Helpers: helpers, Translation: { t }, router } = deps;

    section.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_appendix_hub_intro'),
        })
    );

    const nav = helpers.create_element('nav', {
        class_name: 'audit-settings__hub-nav',
        attributes: { 'aria-label': t('rulefile_appendix_hub_nav_heading') },
    });

    const list = helpers.create_element('ul', { class_name: 'audit-settings__hub-list' });
    const add_hub_link = (appendix: '1' | '2' | '3', label_key: string, desc_key: string) => {
        const item = helpers.create_element('li', { class_name: 'audit-settings__hub-item' });
        const link = helpers.create_element('a', {
            class_name: 'audit-settings__hub-link',
            attributes: { href: '#' },
            text_content: t(label_key),
        });
        link.addEventListener('click', (event) => {
            event.preventDefault();
            router('rulefile_sections', { section: 'report_template', appendix });
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

    add_hub_link('1', 'rulefile_appendix_hub_1_title', 'rulefile_appendix_hub_1_desc');
    add_hub_link('2', 'rulefile_appendix_hub_2_title', 'rulefile_appendix_hub_2_desc');
    add_hub_link('3', 'rulefile_appendix_hub_3_title', 'rulefile_appendix_hub_3_desc');
    nav.appendChild(list);
    section.appendChild(nav);
}

export function create_rulefile_appendix_edit_button(
    deps: RulefileAppendixTemplatesRenderDeps,
    appendix: '1' | '2' | '3',
    aria_key: string
): HTMLButtonElement {
    const { Helpers: helpers, Translation: { t }, router } = deps;
    const edit_button = helpers.create_element('button', {
        class_name: ['button', 'button-secondary', 'rulefile-sections-edit-button'],
        attributes: {
            type: 'button',
            'aria-label': t(aria_key),
        },
        html_content:
            `<span>${t('edit_button_label')}</span>` +
            (helpers.get_icon_svg ? helpers.get_icon_svg('edit') : ''),
    }) as HTMLButtonElement;
    edit_button.addEventListener('click', () => {
        router('rulefile_sections', {
            section: 'report_template',
            appendix,
            edit: 'true',
        });
    });
    return edit_button;
}
