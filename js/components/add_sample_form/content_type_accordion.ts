/**
 * Accordion för avsnittet Innehållstyper i granskningsdelsformuläret.
 * Instruktionstext och alla innehållstypgrupper renderas endast när avsnittet är expanderat.
 */

import { marked } from '../../utils/markdown.js';
import {
    EXPANDABLE_PANEL_EXPANDED_CLASS,
    animate_expandable_panel,
    apply_instant_expanded_panel_state
} from '../../utils/expandable_panel_transition.js';
import {
    is_content_type_analyze_available,
} from './content_type_detection.js';

type ContentTypeChild = {
    id: string;
    text: string;
    description?: string;
};

type ContentTypeGroup = {
    id: string;
    text: string;
    types?: ContentTypeChild[];
};

export function init_content_type_selection(
    component: any,
    effective_sample_data: { selectedContentTypes?: string[] } | null
): void {
    component.content_type_selected_ids = new Set(effective_sample_data?.selectedContentTypes || []);
}

export function sync_content_type_selection_from_dom(component: any): void {
    const panel_inner = component.content_types_section_panel_inner;
    if (!panel_inner || panel_inner.childElementCount === 0) return;

    component.content_type_selected_ids = new Set();
    panel_inner.querySelectorAll('input[name="selectedContentTypes"]:checked').forEach((input: HTMLInputElement) => {
        component.content_type_selected_ids.add(input.value);
    });
}

export function get_selected_content_type_ids(component: any): string[] {
    sync_content_type_selection_from_dom(component);
    return Array.from(component.content_type_selected_ids || []);
}

function render_content_type_instruction_row(component: any, panel_inner: HTMLElement): void {
    const t = component.get_t_internally();
    const row = component.Helpers.create_element('div', {
        class_name: 'content-types-instruction-row'
    });

    row.appendChild(component.Helpers.create_element('p', {
        class_name: 'content-types-instruction-text',
        text_content: t('content_types_instruction'),
        style: { 'color': 'var(--text-color-muted)' }
    }));

    const paste_btn = component.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'content-type-paste-analyze-button'],
        attributes: { type: 'button' },
        text_content: t('content_type_paste_analyze_button')
    });
    paste_btn.addEventListener('click', () => {
        if (typeof component.handle_content_type_paste_analyze_click === 'function') {
            component.handle_content_type_paste_analyze_click();
        }
    });
    row.appendChild(paste_btn);
    panel_inner.appendChild(row);

    component.content_type_paste_analyze_btn = paste_btn;
}

function render_content_type_analyze_toolbar(component: any, panel_inner: HTMLElement): void {
    const t = component.get_t_internally();
    const toolbar = component.Helpers.create_element('div', {
        class_name: 'content-type-analyze-toolbar'
    });

    const analyze_btn = component.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'content-type-analyze-button'],
        attributes: { type: 'button' },
        html_content: `<span class="content-type-analyze-button__label">${t('content_type_analyze_button')}</span>`
    });
    analyze_btn.addEventListener('click', () => {
        if (typeof component.handle_analyze_page_content_click === 'function') {
            void component.handle_analyze_page_content_click();
        }
    });

    toolbar.appendChild(analyze_btn);
    panel_inner.appendChild(toolbar);

    component.content_type_analyze_btn = analyze_btn;

    const show = is_content_type_analyze_available(component);
    analyze_btn.hidden = !show;
    analyze_btn.style.display = show ? '' : 'none';
}

function render_content_type_analyze_status(component: any, panel_inner: HTMLElement): void {
    const live_region = component.Helpers.create_element('p', {
        class_name: 'content-type-analyze-status',
        attributes: {
            'aria-live': 'polite',
            'aria-atomic': 'true'
        },
        style: { 'margin-bottom': '0', 'color': 'var(--text-color-muted)' }
    });
    panel_inner.appendChild(live_region);
    component.content_type_analyze_live_region = live_region;
}

function render_content_type_groups(
    component: any,
    groups: ContentTypeGroup[],
    panel_inner: HTMLElement
): void {
    const t = component.get_t_internally();

    render_content_type_instruction_row(component, panel_inner);
    render_content_type_analyze_status(component, panel_inner);
    render_content_type_analyze_toolbar(component, panel_inner);

    groups.forEach((group: ContentTypeGroup) => {
        const fieldset = component.Helpers.create_element('fieldset', { class_name: 'content-type-parent-group' });
        const group_children_id = `ct-children-${group.id}`;

        fieldset.appendChild(component.Helpers.create_element('legend', {
            class_name: 'visually-hidden',
            text_content: group.text
        }));

        const parent_header = component.Helpers.create_element('div', { class_name: 'content-type-parent-header' });
        const parent_id = `ct-parent-${group.id}`;
        const parent_checkbox = component.Helpers.create_element('input', {
            id: parent_id,
            class_name: 'form-check-input',
            attributes: {
                type: 'checkbox',
                'data-parent-id': group.id,
                'aria-controls': group_children_id,
                'aria-label': `${group.text}, välj alla`
            }
        });
        const parent_h3 = component.Helpers.create_element('h3');
        parent_h3.appendChild(component.Helpers.create_element('label', {
            attributes: { for: parent_id },
            text_content: group.text,
            class_name: 'content-type-parent-label'
        }));
        parent_header.append(parent_checkbox, parent_h3);
        fieldset.appendChild(parent_header);

        const children_container = component.Helpers.create_element('div', {
            class_name: 'content-type-children-container',
            attributes: { id: group_children_id }
        });

        (group.types || []).forEach((child: ContentTypeChild) => {
            const child_id = `ct-child-${child.id}`;
            const child_wrapper = component.Helpers.create_element('div', { class_name: 'form-check content-type-child-item' });
            const desc_id = child.description ? `ct-desc-${child.id}` : null;
            const child_checkbox = component.Helpers.create_element('input', {
                id: child_id,
                class_name: 'form-check-input',
                attributes: {
                    type: 'checkbox',
                    name: 'selectedContentTypes',
                    value: child.id,
                    'data-child-for': group.id,
                    'aria-describedby': desc_id ? desc_id : null,
                    'aria-labelledby': `${child_id}-label`
                }
            });
            const child_label = component.Helpers.create_element('label', {
                attributes: { for: child_id, id: `${child_id}-label` },
                text_content: child.text
            });
            child_wrapper.append(child_checkbox, child_label);
            children_container.appendChild(child_wrapper);

            if (child.description) {
                const desc_div = component.Helpers.create_element('div', {
                    class_name: 'content-type-description markdown-content',
                    attributes: { id: desc_id }
                });
                if (typeof marked !== 'undefined') {
                    const raw_html = marked.parse(child.description);
                    desc_div.innerHTML = component.Helpers.sanitize_html
                        ? component.Helpers.sanitize_html(raw_html)
                        : raw_html;
                } else {
                    desc_div.textContent = child.description;
                }
                children_container.appendChild(desc_div);
            }
        });

        fieldset.appendChild(children_container);
        panel_inner.appendChild(fieldset);
    });

    panel_inner.querySelectorAll('input[data-child-for]').forEach((cb) => {
        const input = cb as HTMLInputElement;
        input.checked = component.content_type_selected_ids?.has(input.value) || false;
    });
    panel_inner.querySelectorAll('input[data-parent-id]').forEach((pc) => {
        component._updateParentCheckboxState(pc);
    });
    sync_content_type_selection_from_dom(component);
}

function mount_section_panel(component: any, groups: ContentTypeGroup[]): void {
    const panel_inner = component.content_types_section_panel_inner;
    if (!panel_inner || panel_inner.childElementCount > 0) return;
    render_content_type_groups(component, groups, panel_inner);
}

function unmount_section_panel(component: any): void {
    sync_content_type_selection_from_dom(component);
    component.content_type_analyze_btn = null;
    component.content_type_paste_analyze_btn = null;
    component.content_type_analyze_live_region = null;
    component.content_types_section_panel_inner?.replaceChildren();
}

async function toggle_content_types_section(
    component: any,
    section: HTMLElement,
    groups: ContentTypeGroup[],
    panel_host: HTMLElement,
    expandable_panel: HTMLElement,
    header_button: HTMLButtonElement,
    title_element: HTMLElement
): Promise<void> {
    if (section.getAttribute('data-animating') === 'true') return;

    const will_open = !section.classList.contains('content-types-section-accordion--open');
    section.setAttribute('data-animating', 'true');
    try {
        if (will_open) {
            mount_section_panel(component, groups);
            section.classList.add('content-types-section-accordion--open');
            header_button.setAttribute('aria-expanded', 'true');
            await animate_expandable_panel(expandable_panel, panel_host, true);
            return;
        }

        section.classList.remove('content-types-section-accordion--open');
        header_button.setAttribute('aria-expanded', 'false');
        await animate_expandable_panel(expandable_panel, panel_host, false);
        unmount_section_panel(component);
        title_element.scrollIntoView({ block: 'start', behavior: 'auto' });
    } finally {
        section.removeAttribute('data-animating');
    }
}

export function render_content_types_section_accordion(
    component: any,
    groups: ContentTypeGroup[],
    effective_sample_data: { selectedContentTypes?: string[] } | null
): void {
    const t = component.get_t_internally();
    init_content_type_selection(component, effective_sample_data);

    const initially_open = component.current_editing_sample_id
        ? false
        : (effective_sample_data?.selectedContentTypes?.length || 0) > 0;
    const section = component.Helpers.create_element('section', {
        class_name: 'content-types-section-accordion'
    });
    const panel_id = 'content-types-section-accordion-panel';
    const heading_id = 'content-types-section-accordion-heading';

    const header_button = component.Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'content-types-section-accordion__header'],
        attributes: {
            type: 'button',
            'aria-controls': panel_id,
            'aria-expanded': initially_open ? 'true' : 'false'
        }
    });
    const header_inner = component.Helpers.create_element('span', {
        class_name: 'content-types-section-accordion__header-inner'
    });
    const title_h2 = component.Helpers.create_element('h2', {
        class_name: 'content-types-section-accordion__title',
        attributes: { id: heading_id },
        text_content: t('content_types')
    });
    header_inner.append(
        title_h2,
        component.Helpers.create_element('span', {
            class_name: 'content-types-section-accordion__chevron',
            attributes: { 'aria-hidden': 'true' }
        })
    );
    header_button.appendChild(header_inner);
    section.appendChild(header_button);

    const panel_host = component.Helpers.create_element('div', {
        class_name: 'content-types-section-accordion__panel-host',
        attributes: {
            id: panel_id,
            role: 'region',
            'aria-labelledby': heading_id
        }
    });
    panel_host.hidden = !initially_open;

    const expandable_panel = component.Helpers.create_element('div', {
        class_name: ['expandable-panel', 'content-types-section-accordion__panel']
    });
    const panel_inner = component.Helpers.create_element('div', {
        class_name: ['expandable-panel__inner', 'content-types-section-accordion__panel-inner']
    });
    expandable_panel.appendChild(panel_inner);
    panel_host.appendChild(expandable_panel);
    section.appendChild(panel_host);

    component.content_types_section_panel_inner = panel_inner;

    header_button.addEventListener('click', () => {
        void toggle_content_types_section(
            component,
            section,
            groups,
            panel_host,
            expandable_panel,
            header_button,
            title_h2
        );
    });

    if (initially_open) {
        section.classList.add('content-types-section-accordion--open');
        mount_section_panel(component, groups);
        apply_instant_expanded_panel_state(expandable_panel, panel_host, true, EXPANDABLE_PANEL_EXPANDED_CLASS);
    }

    component.content_types_container_element.appendChild(section);
}
