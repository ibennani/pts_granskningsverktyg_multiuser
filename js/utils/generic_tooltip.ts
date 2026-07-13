/**
 * @fileoverview Generisk tooltip-controller med DOM mount/unmount och aria-live på textspanen.
 */

import '../../css/components/generic_tooltip.css';

import {
    remove_from_overlay,
    render_in_overlay,
} from './overlay_portal.js';

export type CreateElementFn = (
    tag: string,
    opts?: Record<string, unknown>
) => HTMLElement;

export type TooltipHelpers = {
    create_element: CreateElementFn;
};

export type TooltipMode = 'static' | 'feedback';

export type GenericTooltipOptions = {
    mode: TooltipMode;
    idle_text?: string;
    idle_icon_html?: string;
    use_overlay?: boolean;
};

export type GenericTooltipInit = {
    wrapper: HTMLElement;
    deps: TooltipHelpers;
    options: GenericTooltipOptions;
};

export type CreateTooltipWrapperOptions = {
    content: HTMLElement;
    mode: TooltipMode;
    idle_text?: string;
    idle_icon_html?: string;
    use_overlay?: boolean;
};

export type TooltipWrapperParts = {
    wrapper: HTMLElement;
    tooltip: GenericTooltip;
};

const TOOLTIP_GAP_PX = 6;
const TEXT_CLASS = 'generic-tooltip__text';
const ICON_CLASS = 'generic-tooltip__icon';

function sync_content_attr(tooltip_el: HTMLElement, text_el: HTMLElement | null): void {
    const has_content = Boolean(text_el?.textContent?.trim());
    if (has_content) {
        tooltip_el.setAttribute('data-has-tooltip-content', 'true');
    } else {
        tooltip_el.removeAttribute('data-has-tooltip-content');
    }
}

function position_tooltip_in_overlay(wrapper: HTMLElement, tooltip_el: HTMLElement): void {
    const wr = wrapper.getBoundingClientRect();
    tooltip_el.style.top = `${wr.top - 8}px`;
    tooltip_el.style.left = `${wr.left + wr.width / 2}px`;
    tooltip_el.style.transform = 'translate(-50%, -100%)';
    const tr = tooltip_el.getBoundingClientRect();
    tooltip_el.style.top = `${wr.top - tr.height - TOOLTIP_GAP_PX}px`;
}

function clear_overlay_styles(tooltip_el: HTMLElement): void {
    tooltip_el.classList.remove('generic-tooltip--in-overlay');
    tooltip_el.style.top = '';
    tooltip_el.style.left = '';
    tooltip_el.style.transform = '';
}

function append_icon(
    tooltip_el: HTMLElement,
    deps: TooltipHelpers,
    icon_html: string,
    state?: string
): HTMLElement {
    const icon_el = deps.create_element('span', {
        class_name: state
            ? [ICON_CLASS, `${ICON_CLASS}--${state}`]
            : [ICON_CLASS],
        attributes: { 'aria-hidden': 'true' },
        html_content: icon_html,
    });
    tooltip_el.appendChild(icon_el);
    return icon_el;
}

export class GenericTooltip {
    private wrapper: HTMLElement | null = null;
    private deps: TooltipHelpers | null = null;
    private options: GenericTooltipOptions = { mode: 'static' };
    private tooltip_el: HTMLElement | null = null;
    private text_el: HTMLElement | null = null;
    private pending_raf: number | null = null;
    private feedback_active = false;
    private listeners_bound = false;

    private readonly on_pointer_enter = (): void => {
        this.show_idle_hint();
    };

    private readonly on_pointer_leave = (event: FocusEvent | MouseEvent): void => {
        const related = event.relatedTarget;
        if (related instanceof Node && this.wrapper?.contains(related)) {
            return;
        }
        if (!this.feedback_active) {
            this.hide();
        }
    };

    init({ wrapper, deps, options }: GenericTooltipInit): void {
        this.wrapper = wrapper;
        this.deps = deps;
        this.options = options;
        this.bind_listeners();
    }

    get_tooltip_element(): HTMLElement | null {
        return this.tooltip_el;
    }

    get_text_element(): HTMLElement | null {
        return this.text_el;
    }

    is_mounted(): boolean {
        return Boolean(this.tooltip_el?.isConnected);
    }

    mount_empty_shell(): void {
        if (!this.wrapper || !this.deps || this.tooltip_el?.isConnected) {
            return;
        }

        const tooltip_el = this.deps.create_element('span', {
            class_name: 'generic-tooltip',
            attributes: { 'data-generic-tooltip': 'true' },
        });
        const text_el = this.deps.create_element('span', {
            class_name: TEXT_CLASS,
            attributes: {
                'aria-live': 'polite',
                'aria-atomic': 'true',
            },
        });
        tooltip_el.appendChild(text_el);

        if (this.options.use_overlay) {
            render_in_overlay(tooltip_el);
            tooltip_el.classList.add('generic-tooltip--in-overlay');
            position_tooltip_in_overlay(this.wrapper, tooltip_el);
        } else {
            this.wrapper.appendChild(tooltip_el);
        }

        this.tooltip_el = tooltip_el;
        this.text_el = text_el;
        sync_content_attr(tooltip_el, text_el);
    }

    set_content(text: string, icon_html?: string, state?: string): void {
        this.cancel_pending_raf();
        if (!this.tooltip_el) {
            this.mount_empty_shell();
        }
        const tooltip_el = this.tooltip_el;
        const deps = this.deps;
        if (!tooltip_el || !deps) {
            return;
        }

        this.pending_raf = requestAnimationFrame(() => {
            this.pending_raf = null;
            this.apply_content(tooltip_el, deps, text, icon_html, state);
        });
    }

    update_text(text: string): void {
        if (!this.text_el || !this.tooltip_el) {
            return;
        }
        this.text_el.textContent = text;
        sync_content_attr(this.tooltip_el, this.text_el);
    }

    show(): void {
        this.feedback_active = true;
        if (!this.tooltip_el) {
            this.mount_empty_shell();
        }
        this.tooltip_el?.classList.add('generic-tooltip--active');
    }

    hide(): void {
        this.cancel_pending_raf();
        this.feedback_active = false;
        const tooltip_el = this.tooltip_el;
        if (!tooltip_el) {
            return;
        }

        clear_overlay_styles(tooltip_el);
        remove_from_overlay(tooltip_el);
        tooltip_el.remove();
        this.tooltip_el = null;
        this.text_el = null;
    }

    destroy(): void {
        this.hide();
        this.unbind_listeners();
        this.wrapper = null;
        this.deps = null;
    }

    private apply_content(
        tooltip_el: HTMLElement,
        deps: TooltipHelpers,
        text: string,
        icon_html?: string,
        state?: string
    ): void {
        tooltip_el.replaceChildren();
        tooltip_el.classList.toggle('generic-tooltip--with-icon', Boolean(icon_html));

        const text_el = deps.create_element('span', {
            class_name: TEXT_CLASS,
            attributes: {
                'aria-live': 'polite',
                'aria-atomic': 'true',
            },
            text_content: text,
        });
        tooltip_el.appendChild(text_el);
        this.text_el = text_el;

        if (icon_html) {
            append_icon(tooltip_el, deps, icon_html, state);
        }

        sync_content_attr(tooltip_el, text_el);
        if (this.options.use_overlay && tooltip_el.classList.contains('generic-tooltip--in-overlay') && this.wrapper) {
            position_tooltip_in_overlay(this.wrapper, tooltip_el);
        }
    }

    private show_idle_hint(): void {
        if (this.feedback_active) {
            return;
        }
        const idle_text = this.options.idle_text?.trim();
        if (!idle_text) {
            return;
        }
        if (!this.tooltip_el) {
            this.mount_empty_shell();
        }
        this.set_content(idle_text, this.options.idle_icon_html);
    }

    private cancel_pending_raf(): void {
        if (this.pending_raf !== null) {
            cancelAnimationFrame(this.pending_raf);
            this.pending_raf = null;
        }
    }

    private bind_listeners(): void {
        if (!this.wrapper || this.listeners_bound) {
            return;
        }
        this.wrapper.addEventListener('mouseenter', this.on_pointer_enter);
        this.wrapper.addEventListener('mouseleave', this.on_pointer_leave);
        this.wrapper.addEventListener('focusin', this.on_pointer_enter);
        this.wrapper.addEventListener('focusout', this.on_pointer_leave);
        this.listeners_bound = true;
    }

    private unbind_listeners(): void {
        if (!this.wrapper || !this.listeners_bound) {
            return;
        }
        this.wrapper.removeEventListener('mouseenter', this.on_pointer_enter);
        this.wrapper.removeEventListener('mouseleave', this.on_pointer_leave);
        this.wrapper.removeEventListener('focusin', this.on_pointer_enter);
        this.wrapper.removeEventListener('focusout', this.on_pointer_leave);
        this.listeners_bound = false;
    }
}

export function create_tooltip_wrapper(
    Helpers: TooltipHelpers,
    options: CreateTooltipWrapperOptions
): TooltipWrapperParts {
    const {
        content,
        mode,
        idle_text = '',
        idle_icon_html = '',
        use_overlay = false,
    } = options;

    const wrapper_classes = ['generic-tooltip-wrapper'];
    if (mode === 'feedback') {
        wrapper_classes.push('generic-tooltip-wrapper--feedback');
    }

    const wrapper = Helpers.create_element('span', { class_name: wrapper_classes });
    wrapper.appendChild(content);

    const tooltip = new GenericTooltip();
    tooltip.init({
        wrapper,
        deps: Helpers,
        options: { mode, idle_text, idle_icon_html, use_overlay },
    });

    return { wrapper, tooltip };
}

export function wrap_with_static_tooltip(
    Helpers: TooltipHelpers,
    content: HTMLElement,
    text: string,
    options: { use_overlay?: boolean; icon_html?: string } = {}
): HTMLElement {
    const { wrapper } = create_tooltip_wrapper(Helpers, {
        content,
        mode: 'static',
        idle_text: text,
        idle_icon_html: options.icon_html ?? '',
        use_overlay: options.use_overlay ?? true,
    });
    return wrapper;
}
