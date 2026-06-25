/**
 * @fileoverview Toggle och tillstånd för expanderbara grupprader.
 */

import { animate_audit_group_panel } from '../logic/audit_list_view_transition.js';
import {
    get_audit_group_expanded_key,
    type AuditListGroup,
    type AuditListGroupMode
} from '../logic/audit_list_case_grouping.js';

type RenderContext = {
    expanded_group_keys: Set<string>;
};

export function update_group_summary_state(
    summary_row: HTMLElement,
    expanded: boolean,
    t: (key: string, replacements?: Record<string, unknown>) => string,
    group: AuditListGroup,
    group_mode: AuditListGroupMode
): void {
    summary_row.classList.toggle('audit-group-summary-row--expanded', expanded);
    summary_row.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    const chevron = summary_row.querySelector('.audit-group-summary-row__chevron');
    if (chevron) chevron.textContent = expanded ? '▾' : '▸';
    const label_key = group_mode === 'auditor' ? 'groupLabel' : 'caseNumber';
    const replacements = {
        [label_key]: group.group_key,
        caseNumber: group.group_key,
        count: group.audits.length
    };
    summary_row.setAttribute(
        'aria-label',
        expanded
            ? t('audit_group_row_collapse_aria', replacements)
            : t('audit_group_row_expand_aria', replacements)
    );
}

export function apply_initial_group_panel_state(
    detail_row: HTMLElement,
    panel: HTMLElement,
    expanded: boolean
): void {
    if (expanded) {
        detail_row.hidden = false;
        panel.classList.add('audit-group-detail-panel--expanded', 'audit-group-detail-panel--instant');
        requestAnimationFrame(() => panel.classList.remove('audit-group-detail-panel--instant'));
        return;
    }
    detail_row.hidden = true;
    panel.classList.remove('audit-group-detail-panel--expanded');
}

export function bind_group_row_toggle(
    ctx: RenderContext,
    summary_row: HTMLElement,
    detail_row: HTMLElement,
    panel: HTMLElement,
    detail_inner: HTMLElement,
    group: AuditListGroup,
    group_mode: AuditListGroupMode,
    t: (key: string, replacements?: Record<string, unknown>) => string,
    render_detail_content: () => HTMLElement
): void {
    const mount_detail_content = () => {
        if (detail_inner.childElementCount > 0) return;
        detail_inner.appendChild(render_detail_content());
    };

    const unmount_detail_content = () => {
        detail_inner.replaceChildren();
    };

    const run_toggle = async () => {
        if (detail_row.getAttribute('data-animating') === 'true') return;

        const key = get_audit_group_expanded_key(group_mode, group);
        const will_expand = !ctx.expanded_group_keys.has(key);
        if (will_expand) ctx.expanded_group_keys.add(key);
        else ctx.expanded_group_keys.delete(key);

        detail_row.setAttribute('data-animating', 'true');
        try {
            if (will_expand) mount_detail_content();
            update_group_summary_state(summary_row, will_expand, t, group, group_mode);
            await animate_audit_group_panel(panel, detail_row, will_expand);
            if (!will_expand) unmount_detail_content();
        } finally {
            detail_row.removeAttribute('data-animating');
        }
    };

    summary_row.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('a, button')) return;
        void run_toggle();
    });
    summary_row.addEventListener('keydown', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('a, button')) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void run_toggle();
        }
    });
}
