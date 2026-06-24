/**
 * @fileoverview Hjälpfunktioner för initial DOM-byggnad i ChecklistHandler.
 */

import { marked } from '../../utils/markdown.js';
import { get_status_icon } from '../requirements_list/requirement_list_status_icons.js';
import {
    format_deficiency_id_label,
    should_show_deficiency_id_in_title
} from '../../utils/deficiency_id_display.js';
import type { ChecklistObservationTextHost } from './checklist_observation_text.js';

export type ChecklistDomBuildHost = Omit<ChecklistObservationTextHost, 'requirement_definition_ref' | 'Helpers'> & {
    requirement_definition_ref: {
        checks?: Array<{
            id?: string;
            key?: string;
            condition?: string;
            passCriteria?: Array<{ id?: string; key?: string; requirement?: string }> | null;
        }>;
        title?: string;
    } | null;
    requirement_result_ref: {
        checkResults?: Record<string, unknown>;
        stuckProblemDescription?: string;
    } | null;
    requirement_update_details?: {
        addedChecks?: string[];
        added?: Array<{ checkId: string; passCriterionId: string }>;
        updated?: Array<{ checkId: string; passCriterionId: string }>;
    } | null;
    is_dom_built: boolean;
    Translation: { t: (key: string, params?: Record<string, unknown>) => string };
    Helpers: {
        create_element: (...args: unknown[]) => HTMLElement;
        escape_html?: (s: string) => string;
        sanitize_html?: (html: string) => string;
        get_icon_svg?: (name: string, colors: string[], size: number) => string;
        init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    };
    _flush_all_observation_textareas_to_memory(): void;
    _pick_user_observation_text(check_id: string, pc_id: string): string;
    _sync_observation_wrapper_visibility(
        wrapper: Element | null,
        overall_status: string,
        pc_data: unknown,
        check_id: string,
        pc_id: string
    ): unknown;
};

export function safe_parse_markdown_inline(host: ChecklistDomBuildHost, markdown_string: string): string {
    if (typeof marked === 'undefined' || !host.Helpers.escape_html) {
        return host.Helpers.escape_html!(markdown_string);
    }
    const renderer = new marked.Renderer();
    type LegacyLinkRenderer = (href: string, title: string | null, text: string) => string;
    (renderer as unknown as { link: LegacyLinkRenderer }).link = (href, _title, text) => {
        const safe_href = host.Helpers.escape_html!(href);
        const safe_text = host.Helpers.escape_html!(text);
        return `<a href="${safe_href}" target="_blank" rel="noopener noreferrer">${safe_text}</a>`;
    };
    renderer.html = (html_token: unknown) => {
        const text_to_escape = (typeof html_token === 'object' && html_token !== null && typeof (html_token as { text?: string }).text === 'string')
            ? (html_token as { text: string }).text
            : String(html_token || '');
        return host.Helpers.escape_html!(text_to_escape);
    };
    const parsed_markdown = marked.parse(String(markdown_string || ''), { renderer, breaks: true, gfm: true });
    if (host.Helpers.sanitize_html) {
        return host.Helpers.sanitize_html(parsed_markdown as string);
    }
    return parsed_markdown as string;
}

export function get_plain_text_from_html(html_string: string): string {
    const div = document.createElement('div');
    div.innerHTML = html_string || '';
    return (div.textContent || div.innerText || '').trim();
}

export function button_aria_label_with_context(button_label: string, context_plain: string): string {
    const label = typeof button_label === 'string' ? button_label.trim() : '';
    const ctx = typeof context_plain === 'string' ? context_plain.trim() : '';
    if (!ctx) return label || '';
    if (!label) return ctx;
    return `${label}: ${ctx}`;
}

export function create_audit_toggle_button(
    host: ChecklistDomBuildHost,
    { button_classes, action, aria_label, label_text, icon_status }: {
        button_classes: string[];
        action: string;
        aria_label: string;
        label_text: string;
        icon_status: string;
    }
): HTMLButtonElement {
    const icon_kind = icon_status === 'passed' ? 'passed' : 'failed';
    const button = host.Helpers.create_element('button', {
        class_name: button_classes,
        attributes: {
            type: 'button',
            'data-action': action,
            'aria-pressed': 'false',
            'aria-label': aria_label
        }
    }) as HTMLButtonElement;
    button.appendChild(host.Helpers.create_element('span', {
        class_name: 'audit-toggle-button__icon',
        text_content: get_status_icon(icon_kind),
        attributes: { 'aria-hidden': 'true' }
    }));
    button.appendChild(host.Helpers.create_element('span', {
        class_name: 'audit-toggle-button__label',
        text_content: label_text
    }));
    return button;
}

export function get_pc_result_data(
    check_result_data: { passCriteria?: Record<string, unknown> } | null | undefined,
    pc_id: string
): { status: string; observationDetail?: string; deficiencyId?: string; attachedMediaFilenames?: string[] } {
    return (check_result_data?.passCriteria?.[pc_id]
        ?? check_result_data?.passCriteria?.[String(pc_id)]
        ?? { status: 'not_audited', observationDetail: '' }) as {
        status: string;
        observationDetail?: string;
        deficiencyId?: string;
        attachedMediaFilenames?: string[];
    };
}

export function create_update_badge(host: ChecklistDomBuildHost, type: string): HTMLElement {
    const t = host.Translation.t;
    const is_new = type === 'new';
    const label = is_new ? t('pass_criterion_badge_new') : t('pass_criterion_badge_updated');
    const icon_svg = host.Helpers.get_icon_svg ? host.Helpers.get_icon_svg('update', ['currentColor'], 14) : '';
    const span = host.Helpers.create_element('span', {
        class_name: `pass-criterion-update-badge pass-criterion-update-badge--${type}`,
        attributes: { 'aria-hidden': 'true' }
    });
    if (icon_svg) {
        const icon_wrapper = document.createElement('span');
        icon_wrapper.setAttribute('aria-hidden', 'true');
        icon_wrapper.innerHTML = icon_svg;
        span.appendChild(icon_wrapper);
    }
    span.appendChild(document.createTextNode(' ' + label));
    return span;
}

export function sync_pass_criterion_deficiency_id_on_title(
    host: ChecklistDomBuildHost,
    title_row: HTMLElement,
    audit_frozen: boolean,
    pc_status: string,
    deficiency_id: string | undefined
): void {
    const t = host.Translation.t;
    const show = should_show_deficiency_id_in_title(audit_frozen, pc_status, deficiency_id);
    title_row.querySelector('.pass-criterion-title .pass-criterion-deficiency-id')?.remove();
    let el = title_row.querySelector(':scope > .pass-criterion-deficiency-id');
    if (!show) {
        el?.remove();
        return;
    }
    const label = format_deficiency_id_label(deficiency_id, t);
    if (!label) {
        el?.remove();
        return;
    }
    if (!el) {
        el = host.Helpers.create_element('span', { class_name: 'pass-criterion-deficiency-id' });
        title_row.appendChild(el);
    }
    el.textContent = label;
}

export function set_pass_criterion_title_aria_label(
    pc_title_h4: HTMLElement,
    criterion_title: string,
    pc_status_text: string
): void {
    pc_title_h4.setAttribute('aria-label', [criterion_title, pc_status_text].join('. '));
}

export function create_pass_criterion_title_h4(
    host: ChecklistDomBuildHost & { _audit_frozen_for_ui(): boolean },
    { numbering, check_id, pc_id, check_result_data, details }: {
        numbering: string;
        check_id: string;
        pc_id: string;
        check_result_data: { passCriteria?: Record<string, unknown> } | null | undefined;
        details: ChecklistDomBuildHost['requirement_update_details'];
    }
): HTMLElement {
    const t = host.Translation.t;
    const audit_frozen = host._audit_frozen_for_ui();
    const pc_data = get_pc_result_data(check_result_data, pc_id);
    const current_pc_status = pc_data.status || 'not_audited';
    const criterion_title = `${t('pass_criterion_label')} ${numbering}`;
    const pc_status_text = t(`audit_status_${current_pc_status}`);

    const title_row = host.Helpers.create_element('div', { class_name: 'pass-criterion-title-row' });
    const pc_title_h4 = host.Helpers.create_element('h4', { class_name: 'pass-criterion-title' });
    const title_main = host.Helpers.create_element('span', { class_name: 'pass-criterion-title-main' });
    title_main.appendChild(host.Helpers.create_element('strong', { text_content: criterion_title }));

    const in_added = check_id && pc_id && details?.added?.some(
        (e) => e.checkId === check_id && e.passCriterionId === pc_id
    );
    const in_updated = check_id && pc_id && details?.updated?.some(
        (e) => e.checkId === check_id && e.passCriterionId === pc_id
    );
    if (in_added) {
        title_main.appendChild(document.createTextNode(' '));
        title_main.appendChild(create_update_badge(host, 'new'));
    } else if (in_updated) {
        title_main.appendChild(document.createTextNode(' '));
        title_main.appendChild(create_update_badge(host, 'updated'));
    }
    pc_title_h4.appendChild(title_main);
    title_row.appendChild(pc_title_h4);
    sync_pass_criterion_deficiency_id_on_title(
        host, title_row, audit_frozen, current_pc_status, pc_data.deficiencyId
    );
    set_pass_criterion_title_aria_label(pc_title_h4, criterion_title, pc_status_text);
    return title_row;
}

