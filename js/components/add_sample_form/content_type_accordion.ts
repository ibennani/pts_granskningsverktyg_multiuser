/**
 * Accordion för avsnittet Innehållstyper i stickprovsformuläret.
 * Instruktionstext och alla innehållstypgrupper renderas endast när avsnittet är expanderat.
 */

import { marked } from '../../utils/markdown.js';

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

function render_content_type_groups(
    component: any,
    groups: ContentTypeGroup[],
    panel_inner: HTMLElement
): void {
    const t = component.get_t_internally();

    panel_inner.appendChild(component.Helpers.create_element('p', {
        text_content: t('content_types_instruction'),
        style: { 'margin-top': '0', 'color': 'var(--text-color-muted)' }
    }));

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

    panel_inner.querySelectorAll('input[data-child-for]').forEach((cb: HTMLInputElement) => {
        cb.checked = component.content_type_selected_ids?.has(cb.value) || false;
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

function set_panel_max_height(panel: HTMLElement, height_px: number): void {
    panel.style.maxHeight = `${height_px}px`;
}

function expand_section_panel(panel: HTMLElement): void {
    set_panel_max_height(panel, panel.scrollHeight);
}

function open_content_types_section(
    component: any,
    section: HTMLElement,
    groups: ContentTypeGroup[],
    panel: HTMLElement,
    header_button: HTMLButtonElement
): void {
    mount_section_panel(component, groups);
    section.classList.add('content-types-section-accordion--open');
    header_button.setAttribute('aria-expanded', 'true');
    set_panel_max_height(panel, 0);
    requestAnimationFrame(() => expand_section_panel(panel));
}

const ACCORDION_TRANSITION_MS = 500;

function ease_in_out(progress: number): number {
    return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function get_scroll_target_for_heading(title_element: HTMLElement): number {
    const style = window.getComputedStyle(title_element);
    const scroll_margin_top = Number.parseFloat(style.scrollMarginTop) || 0;
    const rect = title_element.getBoundingClientRect();
    return Math.max(0, window.scrollY + rect.top - scroll_margin_top);
}

function animate_window_scroll_to(target_y: number, duration_ms: number): void {
    const start_y = window.scrollY;
    const distance = target_y - start_y;
    if (Math.abs(distance) < 1) return;

    const start_time = performance.now();
    const step = (now: number) => {
        const progress = Math.min((now - start_time) / duration_ms, 1);
        window.scrollTo(0, start_y + distance * ease_in_out(progress));
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };
    requestAnimationFrame(step);
}

function scroll_to_accordion_heading(title_element: HTMLElement): void {
    const target_y = get_scroll_target_for_heading(title_element);
    const reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced_motion) {
        window.scrollTo(0, target_y);
        return;
    }
    animate_window_scroll_to(target_y, ACCORDION_TRANSITION_MS);
}

function close_content_types_section(
    component: any,
    section: HTMLElement,
    panel: HTMLElement,
    header_button: HTMLButtonElement,
    title_element: HTMLElement
): void {
    sync_content_type_selection_from_dom(component);
    const current_height = panel.scrollHeight;
    section.classList.remove('content-types-section-accordion--open');
    header_button.setAttribute('aria-expanded', 'false');
    set_panel_max_height(panel, current_height);

    const reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const finish_close = () => {
        component.content_types_section_panel_inner?.replaceChildren();
        set_panel_max_height(panel, 0);
    };

    requestAnimationFrame(() => {
        set_panel_max_height(panel, 0);
        scroll_to_accordion_heading(title_element);
        if (reduced_motion) {
            finish_close();
            return;
        }
        panel.addEventListener('transitionend', function on_transition_end(event: TransitionEvent) {
            if (event.target !== panel || event.propertyName !== 'max-height') return;
            panel.removeEventListener('transitionend', on_transition_end);
            finish_close();
        });
    });
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

    const panel = component.Helpers.create_element('div', {
        class_name: 'content-types-section-accordion__panel',
        attributes: {
            id: panel_id,
            role: 'region',
            'aria-labelledby': heading_id
        }
    });
    const panel_inner = component.Helpers.create_element('div', {
        class_name: 'content-types-section-accordion__panel-inner'
    });
    panel.appendChild(panel_inner);
    section.appendChild(panel);

    component.content_types_section_panel_inner = panel_inner;
    set_panel_max_height(panel, 0);

    header_button.addEventListener('click', () => {
        const will_open = !section.classList.contains('content-types-section-accordion--open');
        if (will_open) {
            open_content_types_section(component, section, groups, panel, header_button);
            return;
        }
        close_content_types_section(component, section, panel, header_button, title_h2);
    });

    if (initially_open) {
        open_content_types_section(component, section, groups, panel, header_button);
    }

    component.content_types_container_element.appendChild(section);
}
