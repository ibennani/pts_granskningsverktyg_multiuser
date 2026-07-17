/**
 * @fileoverview Rendering av expanderbar grupperad granskningslista.
 */

import { create_audit_group_table_columns, create_audit_table_columns } from '../utils/audit_table_columns.js';
import {
    build_audit_list_groups,
    get_audit_group_expanded_key,
    type AuditListGroup,
    type AuditListGroupMode,
    type AuditRowForGrouping
} from '../logic/audit_list_case_grouping.js';
import { slice_rows_for_page } from '../logic/table_pagination_logic.js';
import { create_table_pagination_element } from './table_pagination_bar.js';
import {
    apply_initial_group_panel_state,
    bind_group_row_toggle,
    update_group_summary_state
} from './audit_group_row_ui.js';
import { build_group_detail_table, type DetailColumnDef } from './audit_group_detail_table.js';
import { open_audit_group_actor_edit_modal } from './audit_group_actor_edit_modal.js';

type SortState = { columnIndex: number; direction: 'asc' | 'desc' };

type ColumnDef = {
    headerLabel: string;
    getContent: (row: AuditListGroup) => string | HTMLElement;
    getSortValue?: (row: AuditListGroup) => string | number;
    isAction?: boolean;
};

type RenderContext = {
    Helpers: { create_element: (...args: unknown[]) => HTMLElement };
    Translation: { t: (key: string, replacements?: Record<string, unknown>) => string };
    expanded_group_keys: Set<string>;
};

export type AuditGroupedListRenderOpts = {
    root: HTMLElement;
    audits: AuditRowForGrouping[];
    groupMode?: AuditListGroupMode;
    minGroupSize?: number;
    emptyMessage: string;
    emptyMessageNoGroups?: string;
    ariaLabel: string;
    sortState?: SortState;
    onSort?: (columnIndex: number, direction: 'asc' | 'desc') => void;
    includeDelete?: boolean;
    onOpenAudit: (id: string | number) => void;
    onDownloadAudit: (id: string | number) => void;
    onDeleteAudit?: (id: string | number, displayName: string, deleteButton: HTMLElement) => void;
    get_status_label?: (status: string) => string;
    pagination?: {
        current_page?: number;
        page_size: number | null;
        on_page_change: (page: number) => void;
    };
    pending_sort_focus_index?: number;
    on_pending_sort_focus_done?: () => void;
};

function compare_sort_values(va: unknown, vb: unknown): number {
    const a_empty = va === '' || va === null || va === undefined;
    const b_empty = vb === '' || vb === null || vb === undefined;
    if (a_empty && b_empty) return 0;
    if (a_empty) return 1;
    if (b_empty) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va).localeCompare(String(vb), undefined, { numeric: true });
}

function sort_case_groups(
    groups: AuditListGroup[],
    columns: ColumnDef[],
    sortState?: SortState
): AuditListGroup[] {
    const col = sortState ? columns[sortState.columnIndex] : undefined;
    if (!col?.getSortValue || !sortState) return groups;
    const dir = sortState.direction === 'desc' ? -1 : 1;
    return [...groups].sort((a, b) =>
        compare_sort_values(col.getSortValue!(a), col.getSortValue!(b)) * dir
    );
}

function get_group_summary_col_classes(column_count: number): string[] {
    if (column_count === 2) {
        return ['audit-group-col-case', 'audit-group-col-count'];
    }
    return ['audit-group-col-case', 'audit-group-col-actor', 'audit-group-col-count'];
}

function append_group_summary_cell(
    Helpers: RenderContext['Helpers'],
    cell: HTMLElement,
    col_index: number,
    main_content: string | HTMLElement,
    chevron_char?: string,
    trailing_element?: HTMLElement
): void {
    const inner = Helpers.create_element('div', { class_name: 'audit-group-summary-cell' });
    if (col_index === 0) {
        const chevron_classes = ['audit-group-summary-row__chevron'];
        if (chevron_char === undefined) {
            chevron_classes.push('audit-group-summary-row__chevron--header-spacer');
        }
        const chevron = Helpers.create_element('span', {
            class_name: chevron_classes,
            attributes: { 'aria-hidden': 'true' },
            text_content: chevron_char ?? '▸'
        });
        inner.appendChild(chevron);
    }
    const main = Helpers.create_element('span', { class_name: 'audit-group-summary-cell__main' });
    if (typeof main_content === 'string') {
        main.textContent = main_content;
    } else {
        main.appendChild(main_content);
    }
    inner.appendChild(main);
    if (trailing_element) {
        inner.appendChild(trailing_element);
    }
    cell.appendChild(inner);
}

function create_group_actor_edit_button(
    Helpers: RenderContext['Helpers'],
    t: (key: string, replacements?: Record<string, unknown>) => string,
    group: AuditListGroup,
    actor_name: string
): HTMLElement {
    const edit_btn = Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'audit-group-actor-edit-btn'],
        text_content: t('edit_button_label'),
        attributes: {
            type: 'button',
            'aria-label': t('audit_group_actor_edit_aria', {
                caseNumber: group.group_key,
                actorName: actor_name
            })
        }
    });
    edit_btn.addEventListener('click', (e) => {
        e.stopPropagation();
        open_audit_group_actor_edit_modal(group, actor_name, { Helpers, t }, edit_btn);
    });
    edit_btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
        }
    });
    return edit_btn;
}

function append_group_table_header(
    table: HTMLElement,
    Helpers: RenderContext['Helpers'],
    columns: ColumnDef[],
    summary_col_classes: string[],
    sortState: SortState,
    t: (key: string, replacements?: Record<string, unknown>) => string,
    onSort: ((columnIndex: number, direction: 'asc' | 'desc') => void) | undefined
): void {
    const thead = Helpers.create_element('thead', {});
    const header_row = Helpers.create_element('tr', {});
    columns.forEach((col, col_index) => {
        const is_sortable = typeof col.getSortValue === 'function' && typeof onSort === 'function';
        const is_active = sortState.columnIndex === col_index;
        const direction = is_active ? sortState.direction : 'asc';
        const th = Helpers.create_element('th', {
            attributes: { scope: 'col' },
            class_name: summary_col_classes[col_index]
        });
        if (is_sortable) {
            th.setAttribute(
                'aria-sort',
                is_active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
            );
            const btn_attrs: Record<string, string> = { type: 'button' };
            if (is_active) {
                btn_attrs['aria-label'] = t('generic_table_sort_aria_active', {
                    label: col.headerLabel,
                    direction:
                        direction === 'asc'
                            ? t('generic_table_sort_asc')
                            : t('generic_table_sort_desc')
                });
            }
            const btn = Helpers.create_element('button', {
                type: 'button',
                class_name: 'generic-table-header-sort-btn',
                text_content: col.headerLabel,
                attributes: btn_attrs
            });
            btn.addEventListener('click', () => {
                const next_dir = is_active && direction === 'asc' ? 'desc' : 'asc';
                onSort?.(col_index, next_dir);
            });
            append_group_summary_cell(Helpers, th, col_index, btn);
        } else {
            append_group_summary_cell(Helpers, th, col_index, col.headerLabel);
        }
        header_row.appendChild(th);
    });
    thead.appendChild(header_row);
    table.appendChild(thead);
}

/** Renderar grupperad lista med klickbara expanderbara grupprader. */
export function render_audit_grouped_list(
    ctx: RenderContext,
    opts: AuditGroupedListRenderOpts
): void {
    const { Helpers, Translation, expanded_group_keys } = ctx;
    const t = Translation.t.bind(Translation);
    opts.root.innerHTML = '';

    const audits = opts.audits || [];
    const group_mode: AuditListGroupMode = opts.groupMode === 'auditor' ? 'auditor' : 'case';
    const min_group_size = opts.minGroupSize ?? 2;
    const groups = build_audit_list_groups(audits, group_mode, { min_group_size });
    const empty_message =
        audits.length > 0 && groups.length === 0
            ? opts.emptyMessageNoGroups || opts.emptyMessage
            : opts.emptyMessage;

    if (groups.length === 0) {
        opts.root.appendChild(
            Helpers.create_element('p', {
                class_name: 'audit-grouped-list-empty',
                text_content: empty_message
            })
        );
        return;
    }

    const group_columns = create_audit_group_table_columns(
        { t: t as (key: string, replacements?: object) => string },
        { groupMode: group_mode }
    ) as ColumnDef[];

    const sort_state = opts.sortState ?? { columnIndex: 0, direction: 'asc' };
    const max_sort_col = group_columns.length - 1;
    const clamped_sort =
        sort_state.columnIndex > max_sort_col
            ? { columnIndex: 0, direction: sort_state.direction }
            : sort_state;
    const summary_col_classes = get_group_summary_col_classes(group_columns.length);

    const get_status_label =
        typeof opts.get_status_label === 'function' ? opts.get_status_label : (s: string) => s;
    const detail_columns = create_audit_table_columns(
        { t, Helpers, Translation, get_status_label },
        {
            onOpenAudit: opts.onOpenAudit,
            onDownloadAudit: opts.onDownloadAudit,
            onDeleteAudit: opts.onDeleteAudit
        },
        { includeDelete: opts.includeDelete === true, omitCaseNumberColumn: true, omitAuditorColumn: group_mode === 'auditor' }
    ) as DetailColumnDef[];

    const sorted_groups = sort_case_groups(groups, group_columns, clamped_sort);
    const pag = opts.pagination;
    const page_size =
        pag && Object.prototype.hasOwnProperty.call(pag, 'page_size') ? pag.page_size : null;
    const page_groups =
        pag && page_size !== null && page_size > 0
            ? slice_rows_for_page(sorted_groups, pag.current_page ?? 0, page_size)
            : sorted_groups;

    const stack = Helpers.create_element('div', { class_name: 'generic-table-stack audit-grouped-list-stack' });
    const wrapper = Helpers.create_element('div', { class_name: 'generic-table-wrapper audit-grouped-list' });

    const table = Helpers.create_element('table', {
        class_name: 'generic-table generic-table--audit-group-list audit-grouped-list__table',
        attributes: { 'aria-label': opts.ariaLabel }
    });
    const colgroup = Helpers.create_element('colgroup', {});
    for (const col_class of summary_col_classes) {
        colgroup.appendChild(Helpers.create_element('col', { class_name: col_class }));
    }
    table.appendChild(colgroup);
    append_group_table_header(table, Helpers, group_columns, summary_col_classes, clamped_sort, t, opts.onSort);
    const tbody = Helpers.create_element('tbody', {});

    for (const group of page_groups) {
        const expanded_key = get_audit_group_expanded_key(group_mode, group);
        const is_expanded = expanded_group_keys.has(expanded_key);
        const summary_row = Helpers.create_element('tr', {
            class_name: ['audit-group-summary-row', ...(is_expanded ? ['audit-group-summary-row--expanded'] : [])],
            attributes: {
                'data-group-key': group.group_key,
                'data-group-mode': group_mode,
                tabindex: '0',
                'aria-expanded': is_expanded ? 'true' : 'false'
            }
        });

        group_columns.forEach((col, col_index) => {
            const td = Helpers.create_element('td', {
                class_name: summary_col_classes[col_index]
            });
            const content = col.getContent(group);
            const chevron_char = col_index === 0 ? (is_expanded ? '▾' : '▸') : undefined;
            const show_actor_edit = group_mode === 'case' && col_index === 1;
            const actor_name = show_actor_edit && typeof content === 'string' ? content : '';
            const trailing = show_actor_edit
                ? create_group_actor_edit_button(Helpers, t, group, actor_name)
                : undefined;
            if (typeof content === 'string') {
                append_group_summary_cell(Helpers, td, col_index, content, chevron_char, trailing);
            } else if (content instanceof HTMLElement) {
                append_group_summary_cell(Helpers, td, col_index, content, chevron_char, trailing);
            }
            summary_row.appendChild(td);
        });

        const detail_row = Helpers.create_element('tr', { class_name: 'audit-group-detail-row' });
        const detail_cell = Helpers.create_element('td', {
            attributes: { colspan: String(group_columns.length) },
            class_name: 'audit-group-detail-row__cell'
        });
        const detail_panel = Helpers.create_element('div', { class_name: 'audit-group-detail-panel' });
        const detail_inner = Helpers.create_element('div', { class_name: 'audit-group-detail-panel__inner' });
        if (is_expanded) {
            detail_inner.appendChild(
                build_group_detail_table(ctx, group, detail_columns, t('audit_group_detail_row_number_col'))
            );
        }
        detail_panel.appendChild(detail_inner);
        detail_cell.appendChild(detail_panel);
        detail_row.appendChild(detail_cell);

        apply_initial_group_panel_state(detail_row, detail_panel, is_expanded);
        update_group_summary_state(summary_row, is_expanded, t, group, group_mode);
        bind_group_row_toggle(
            ctx,
            summary_row,
            detail_row,
            detail_panel,
            detail_inner,
            group,
            group_mode,
            t,
            () => build_group_detail_table(ctx, group, detail_columns, t('audit_group_detail_row_number_col'))
        );

        tbody.appendChild(summary_row);
        tbody.appendChild(detail_row);
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
    stack.appendChild(wrapper);

    if (pag && typeof pag.on_page_change === 'function' && page_size !== null && page_size > 0) {
        const pag_el = create_table_pagination_element(Helpers.create_element, {
            current_page: pag.current_page ?? 0,
            total_rows: sorted_groups.length,
            page_size,
            t: t as (key: string, replacements?: object) => string,
            on_page_change: pag.on_page_change
        });
        if (pag_el) stack.appendChild(pag_el);
    }

    opts.root.appendChild(stack);

    if (typeof opts.pending_sort_focus_index === 'number') {
        const idx = opts.pending_sort_focus_index;
        opts.on_pending_sort_focus_done?.();
        const buttons = wrapper.querySelectorAll('.generic-table-header-sort-btn');
        const target = buttons[idx] as HTMLElement | undefined;
        if (target) {
            try {
                target.focus({ preventScroll: true });
            } catch {
                target.focus();
            }
        }
    }
}
