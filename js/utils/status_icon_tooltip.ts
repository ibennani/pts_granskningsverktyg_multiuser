/**
 * @fileoverview Gemensam byggare för Leffes standard-tooltip (status-icon-tooltip-wrapper).
 */

export type CreateElementFn = (
    tag: string,
    opts?: Record<string, unknown>
) => HTMLElement;

export type StatusIconTooltipHelpers = {
    create_element: CreateElementFn;
};

export type CreateStatusIconTooltipWrapperOptions = {
    content: HTMLElement;
    idle_tooltip_text?: string;
    include_live_region?: boolean;
};

export type StatusIconTooltipParts = {
    wrapper: HTMLElement;
    live_region: HTMLElement | null;
    tooltip_el: HTMLElement;
};

const LIVE_REGION_SELECTOR = '[data-file-download-live]';

export function find_file_download_live_region(wrapper: Element): HTMLElement | null {
    const region = wrapper.querySelector(LIVE_REGION_SELECTOR);
    return region instanceof HTMLElement ? region : null;
}

/**
 * Skapar wrapper med Leffes tooltip-mönster. aria-live-region skapas före tooltip-elementet.
 */
export function create_status_icon_tooltip_wrapper(
    Helpers: StatusIconTooltipHelpers,
    options: CreateStatusIconTooltipWrapperOptions
): StatusIconTooltipParts {
    const { content, idle_tooltip_text = '', include_live_region = false } = options;

    const wrapper = Helpers.create_element('span', {
        class_name: ['status-icon-tooltip-wrapper', 'file-download-tooltip-wrapper'],
    });

    wrapper.appendChild(content);

    let live_region: HTMLElement | null = null;
    if (include_live_region) {
        live_region = Helpers.create_element('span', {
            class_name: 'visually-hidden',
            attributes: {
                'aria-live': 'polite',
                'aria-atomic': 'true',
                'data-file-download-live': 'true',
            },
        });
        wrapper.appendChild(live_region);
    }

    const tooltip_el = Helpers.create_element('span', {
        class_name: 'status-icon-tooltip',
        text_content: idle_tooltip_text,
        attributes: { 'aria-hidden': 'true', 'data-file-download-tooltip': 'true' },
    });
    wrapper.appendChild(tooltip_el);

    return { wrapper, live_region, tooltip_el };
}
