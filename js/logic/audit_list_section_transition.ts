/**
 * @fileoverview Sektionsanimation (0,25 s) när granskningslisttabeller visas eller döljs vid filter.
 */

import {
    EXPANDABLE_PANEL_EXPANDED_CLASS,
    EXPANDABLE_PANEL_INSTANT_CLASS,
    prefers_reduced_motion,
    wait_element_transition
} from '../utils/expandable_panel_transition.js';
import {
    type AuditListFilterContext,
    is_audit_list_show_all_sections_mode
} from './audit_list_section_filter.js';

export const AUDIT_LIST_SECTION_TRANSITION_MS = 250;
export const AUDIT_LIST_TABLE_FADE_MS = 125;

const AUDIT_LIST_SECTION_ANIM_SELECTOR = '.audit-list-section-anim';
const TABLE_PAGE_TRANSITION_EXIT_CLASS = 'generic-table-stack--transition-exit';
const TABLE_PAGE_TRANSITION_ENTER_CLASS = 'generic-table-stack--transition-enter-start';

function clear_table_stack_transition_classes(stack: HTMLElement | null): void {
    if (!stack) return;
    stack.classList.remove(TABLE_PAGE_TRANSITION_EXIT_CLASS, TABLE_PAGE_TRANSITION_ENTER_CLASS);
}

function next_animation_frame(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
    });
}

/** Söker sektion i listcontainern via heading_key. */
export function find_audit_list_section(container: HTMLElement, heading_key: string): HTMLElement | null {
    return container.querySelector(
        `[data-audit-section-key="${CSS.escape(heading_key)}"]`
    ) as HTMLElement | null;
}

/** Returnerar synliga sektionsnycklar i DOM-ordning. */
export function collect_audit_section_keys_from_container(container: HTMLElement | null): string[] {
    if (!container) return [];
    return [...container.querySelectorAll('[data-audit-section-key]')]
        .map((el) => el.getAttribute('data-audit-section-key'))
        .filter((key): key is string => Boolean(key));
}

function get_section_anim_host(section: HTMLElement): HTMLElement | null {
    return section.querySelector(AUDIT_LIST_SECTION_ANIM_SELECTOR) as HTMLElement | null;
}

/** Kollapsar en sektion (0,25 s) innan den tas bort från DOM. */
export async function animate_audit_list_section_hide(section: HTMLElement): Promise<void> {
    const host = get_section_anim_host(section);
    if (!host || prefers_reduced_motion()) {
        return;
    }
    host.classList.remove(EXPANDABLE_PANEL_EXPANDED_CLASS);
    await wait_element_transition(host, AUDIT_LIST_SECTION_TRANSITION_MS);
}

/**
 * Expanderar alla listsektioner utan animation när inget filter avgränsar listan.
 * Sektioner ska visa rubrik och tabell direkt, inte ligga kvar i kollapsat tillstånd.
 */
export function expand_audit_list_sections_for_show_all_mode(
    container: HTMLElement | null,
    ctx: AuditListFilterContext
): void {
    if (!container || !is_audit_list_show_all_sections_mode(ctx)) return;
    const hosts = container.querySelectorAll(AUDIT_LIST_SECTION_ANIM_SELECTOR);
    hosts.forEach((host_el) => {
        const host = host_el as HTMLElement;
        host.classList.add(EXPANDABLE_PANEL_EXPANDED_CLASS, EXPANDABLE_PANEL_INSTANT_CLASS);
        requestAnimationFrame(() => host.classList.remove(EXPANDABLE_PANEL_INSTANT_CLASS));
    });
}

/** Expanderar en sektion (0,25 s) efter att den lagts i DOM. */
export async function animate_audit_list_section_show(section: HTMLElement): Promise<void> {
    const host = get_section_anim_host(section);
    if (!host || prefers_reduced_motion()) {
        if (host) host.classList.add(EXPANDABLE_PANEL_EXPANDED_CLASS);
        return;
    }
    host.classList.remove(EXPANDABLE_PANEL_EXPANDED_CLASS);
    await next_animation_frame();
    host.classList.add(EXPANDABLE_PANEL_EXPANDED_CLASS);
    await wait_element_transition(host, AUDIT_LIST_SECTION_TRANSITION_MS);
}

function get_table_stacks_for_sections(container: HTMLElement, heading_keys: string[]): HTMLElement[] {
    const stacks: HTMLElement[] = [];
    heading_keys.forEach((key) => {
        const section = find_audit_list_section(container, key);
        const stack = section?.querySelector('.generic-table-stack') as HTMLElement | null;
        if (stack) stacks.push(stack);
    });
    return stacks;
}

async function fade_table_stacks(stacks: HTMLElement[], fade_out: boolean): Promise<void> {
    if (!stacks.length || prefers_reduced_motion()) return;
    const duration_ms = AUDIT_LIST_TABLE_FADE_MS;
    stacks.forEach((stack) => {
        clear_table_stack_transition_classes(stack);
        stack.style.setProperty('--table-page-opacity-duration', `${duration_ms}ms`);
        if (fade_out) {
            stack.classList.add(TABLE_PAGE_TRANSITION_EXIT_CLASS);
        } else {
            stack.classList.add(TABLE_PAGE_TRANSITION_ENTER_CLASS);
        }
    });
    await Promise.all(stacks.map((stack) => wait_element_transition(stack, duration_ms)));
    stacks.forEach((stack) => {
        clear_table_stack_transition_classes(stack);
        stack.style.removeProperty('--table-page-opacity-duration');
        if (!fade_out) {
            stack.classList.remove(TABLE_PAGE_TRANSITION_ENTER_CLASS);
        }
    });
}

/** Tonar ut tabellstackar i angivna sektioner (0,125 s). */
export async function fade_audit_list_table_stacks_out(
    container: HTMLElement,
    heading_keys: string[]
): Promise<void> {
    await fade_table_stacks(get_table_stacks_for_sections(container, heading_keys), true);
}

/** Tonar in tabellstackar i angivna sektioner (0,125 s). */
export async function fade_audit_list_table_stacks_in(
    container: HTMLElement,
    heading_keys: string[]
): Promise<void> {
    const stacks = get_table_stacks_for_sections(container, heading_keys);
    if (!stacks.length || prefers_reduced_motion()) return;
    const duration_ms = AUDIT_LIST_TABLE_FADE_MS;
    stacks.forEach((stack) => {
        clear_table_stack_transition_classes(stack);
        stack.style.setProperty('--table-page-opacity-duration', `${duration_ms}ms`);
        stack.classList.add(TABLE_PAGE_TRANSITION_ENTER_CLASS);
    });
    await next_animation_frame();
    stacks.forEach((stack) => stack.classList.remove(TABLE_PAGE_TRANSITION_ENTER_CLASS));
    await Promise.all(stacks.map((stack) => wait_element_transition(stack, duration_ms)));
    stacks.forEach((stack) => {
        clear_table_stack_transition_classes(stack);
        stack.style.removeProperty('--table-page-opacity-duration');
    });
}
