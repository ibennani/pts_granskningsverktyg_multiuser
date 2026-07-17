// js/components/audit_view/AuditSamplesSection.js
// Bygger högerkolumnen: granskningar (listor eller sektioner beroende på audit_mode).

import {
    build_audit_list_section_configs,
    is_audit_list_grouped_view_mode
} from '../../logic/audit_list_section_filter.js';
import { clamp_page_index } from '../../logic/table_pagination_logic.js';
import {
    build_audit_list_groups,
    count_audits_in_auditor_groups,
    resolve_audit_list_min_group_size
} from '../../logic/audit_list_case_grouping.js';
import { clear_audit_lists_transition_classes } from '../../logic/audit_list_view_transition.js';
import { create_file_download_button } from '../../utils/file_download_button_ui.js';

function get_audit_section_table_keys(heading_key) {
    const empty_key =
        heading_key === 'start_view_audits_heading'
            ? 'start_view_no_audits'
            : heading_key === 'start_view_new_audits_heading'
                ? 'start_view_no_new_audits'
                : heading_key === 'start_view_archived_audits_heading'
                    ? 'start_view_no_archived_audits'
                    : 'start_view_no_completed_audits';
    const sort_state_key =
        heading_key === 'start_view_audits_heading'
            ? '_inProgressTableSortState'
            : heading_key === 'start_view_new_audits_heading'
                ? '_newTableSortState'
                : heading_key === 'start_view_archived_audits_heading'
                    ? '_archivedTableSortState'
                    : '_completedTableSortState';
    const grouped_sort_state_key =
        heading_key === 'start_view_audits_heading'
            ? '_inProgressGroupedTableSortState'
            : heading_key === 'start_view_new_audits_heading'
                ? '_newGroupedTableSortState'
                : heading_key === 'start_view_archived_audits_heading'
                    ? '_archivedGroupedTableSortState'
                    : '_completedGroupedTableSortState';
    const page_state_key = `_auditListPage_${heading_key}`;
    return { empty_key, sort_state_key, grouped_sort_state_key, page_state_key };
}

function get_audit_list_group_options(ctx) {
    const has_narrowing = ctx._audit_list_has_narrowing_filter === true;
    return { min_group_size: resolve_audit_list_min_group_size(has_narrowing) };
}

/** Antal rader som faktiskt visas i sektionens tabell (grupper eller enskilda granskningar). */
function get_audit_section_display_count(audits, ctx) {
    const list = audits || [];
    const is_grouped = is_audit_list_grouped_view_mode(ctx.audit_list_group_mode);
    if (is_grouped) {
        const group_mode = ctx.audit_list_group_mode === 'auditor' ? 'auditor' : 'case';
        return build_audit_list_groups(list, group_mode, get_audit_list_group_options(ctx)).length;
    }
    return list.length;
}

/** Antal för sektionsrubrik (kan skilja från tabellrader vid gruppering per granskare). */
function get_audit_section_heading_count(audits, ctx) {
    const list = audits || [];
    const has_narrowing = ctx._audit_list_has_narrowing_filter === true;
    if (has_narrowing) {
        return list.length;
    }
    if (ctx.audit_list_group_mode === 'auditor') {
        return count_audits_in_auditor_groups(list, get_audit_list_group_options(ctx));
    }
    return get_audit_section_display_count(audits, ctx);
}

/** Renderar om en enskild granskningslisttabell utan att bygga om hela vyn. */
function render_audit_section_table(ctx, config, table_wrapper, section_heading_text, t) {
    const { empty_key, sort_state_key, grouped_sort_state_key, page_state_key } =
        get_audit_section_table_keys(config.heading_key);
    ctx[sort_state_key] = ctx[sort_state_key] ?? { columnIndex: 0, direction: 'asc' };
    ctx[grouped_sort_state_key] = ctx[grouped_sort_state_key] ?? { columnIndex: 0, direction: 'asc' };
    const page_size_num = ctx.get_audit_table_page_size_number();
    const is_grouped = is_audit_list_grouped_view_mode(ctx.audit_list_group_mode);
    const group_mode = ctx.audit_list_group_mode === 'auditor' ? 'auditor' : 'case';
    const total_list_rows = get_audit_section_display_count(config.audits || [], ctx);
    ctx[page_state_key] = clamp_page_index(ctx[page_state_key] ?? 0, total_list_rows, page_size_num);
    const rerender_table = () => {
        render_audit_section_table(ctx, config, table_wrapper, section_heading_text, t);
    };
    const pagination =
        page_size_num !== null && total_list_rows > 0
            ? {
                current_page: ctx[page_state_key],
                page_size: page_size_num,
                on_page_change: (p) => {
                    ctx[page_state_key] = p;
                    rerender_table();
                }
            }
            : undefined;
    const no_groups_key =
        group_mode === 'auditor' ? 'audit_grouped_no_groups_auditor' : 'audit_grouped_no_groups';
    const list_render_opts = {
        root: table_wrapper,
        audits: config.audits,
        emptyMessage: t(empty_key),
        emptyMessageNoGroups: t(no_groups_key),
        minGroupSize: resolve_audit_list_min_group_size(ctx._audit_list_has_narrowing_filter === true),
        ariaLabel: section_heading_text,
        includeDelete: true,
        sortState: is_grouped ? ctx[grouped_sort_state_key] : ctx[sort_state_key],
        onSort: (columnIndex, direction) => {
            const key = is_grouped ? grouped_sort_state_key : sort_state_key;
            const max_col = is_grouped ? (group_mode === 'auditor' ? 1 : 2) : Number.MAX_SAFE_INTEGER;
            ctx[key] = {
                columnIndex: Math.min(columnIndex, max_col),
                direction
            };
            rerender_table();
        },
        onOpenAudit: (id) => ctx.handle_open_audit(id),
        onDownloadAudit: (id) => ctx.handle_download_audit(id),
        onDeleteAudit: (id, displayName, deleteButton) =>
            ctx.handle_delete_audit_click(id, displayName, deleteButton),
        get_status_label: ctx.get_status_label.bind(ctx),
        pagination,
        sortControlsIdPrefix: `audit-list-sort-${config.heading_key}`
    };
    if (is_grouped) {
        ctx._auditGroupedListComponent.render({ ...list_render_opts, groupMode: group_mode });
    } else {
        ctx._auditListComponent.render(list_render_opts);
    }
}

/** Renderar granskningssektionerna (listor) i befintlig container utan att röra filterraden. */
export function render_audit_audits_sections(ctx, container) {
    if (!container) return;
    clear_audit_lists_transition_classes(container);
    const t = ctx.get_t_func();
    container.innerHTML = '';
    container.classList.add('audit-audits-sections-container');

    const { section_configs, has_list_narrowing_filter } = build_audit_list_section_configs(ctx);
    ctx._audit_list_has_narrowing_filter = has_list_narrowing_filter;
    ctx._audit_list_has_active_filter = has_list_narrowing_filter;
    section_configs.forEach((config, index) => {
        const section = ctx.Helpers.create_element('section', {
            class_name: index === 0 ? 'start-view-audits-section' : 'start-view-audits-section start-view-audits-section-following',
            attributes: { 'aria-labelledby': `${config.heading_key}-heading` }
        });
        const heading_row = ctx.Helpers.create_element('div', { class_name: 'start-view-section-heading-row' });
        const heading_title = t(config.heading_key);
        const section_count = get_audit_section_heading_count(config.heading_audits || [], ctx);
        const section_heading_text = t('start_view_section_heading_with_count', {
            title: heading_title,
            count: section_count
        });
        const section_heading = ctx.Helpers.create_element('h2', {
            id: `${config.heading_key}-heading`,
            text_content: section_heading_text
        });
        heading_row.appendChild(section_heading);
        if (config.heading_key === 'start_view_audits_heading') {
            const upload_audit_btn = ctx.Helpers.create_element('button', {
                class_name: ['button', 'button-primary', 'audit-upload-audit-btn'],
                text_content: t('audit_upload_saved_audit'),
                attributes: { type: 'button', 'aria-label': t('audit_upload_saved_audit') }
            });
            upload_audit_btn.addEventListener('click', ctx.handle_audit_upload_click);
            ctx.upload_audit_file_input = ctx.Helpers.create_element('input', {
                class_name: 'audit-hidden-file-input',
                attributes: {
                    type: 'file',
                    accept: '.json,application/json',
                    'aria-label': t('audit_upload_saved_audit'),
                    tabindex: '-1',
                    'aria-hidden': 'true'
                }
            });
            ctx.upload_audit_file_input.addEventListener('change', ctx.handle_audit_file_select);
            heading_row.appendChild(upload_audit_btn);
            heading_row.appendChild(ctx.upload_audit_file_input);
        }
        if (config.heading_key === 'start_view_new_audits_heading') {
            const start_new_btn = ctx.Helpers.create_element('button', {
                class_name: ['button', 'button-primary', 'audit-start-new-audit-btn'],
                text_content: t('start_new_audit'),
                attributes: { type: 'button', 'aria-label': t('start_new_audit') }
            });
            start_new_btn.addEventListener('click', ctx.handle_start_new_audit);
            heading_row.appendChild(start_new_btn);
        }
        section.appendChild(heading_row);
        const table_wrapper = ctx.Helpers.create_element('div');
        render_audit_section_table(ctx, config, table_wrapper, section_heading_text, t);
        section.appendChild(table_wrapper);
        container.appendChild(section);
    });
}

export function render_audit_samples_section(ctx) {
    const t = ctx.get_t_func();
    const right_col = ctx.Helpers.create_element(
        ctx.audit_mode === 'audits' ? 'div' : 'section',
        ctx.audit_mode === 'audits'
            ? {}
            : { class_name: 'audit-column', attributes: { 'aria-labelledby': 'audit-audits-heading' } }
    );

    if (ctx.audit_mode === 'audits') {
        render_audit_audits_sections(ctx, right_col);
    } else {
        const audits_heading_row = ctx.Helpers.create_element('div', { class_name: 'audit-column-heading-row' });
        const audits_heading = ctx.Helpers.create_element('h2', {
            id: 'audit-audits-heading',
            text_content: t('audit_audits_title')
        });
        audits_heading_row.appendChild(audits_heading);
        right_col.appendChild(audits_heading_row);
        const audits_list = ctx.Helpers.create_element('ul', { class_name: 'audit-list' });
        if (ctx.audits.length === 0) {
            const empty = ctx.Helpers.create_element('li', {
                class_name: 'audit-list-empty',
                text_content: t('audit_audits_empty')
            });
            audits_list.appendChild(empty);
        } else {
            const sorted_audits = [...ctx.audits].sort((a, b) => {
                const ca = (a.metadata?.caseNumber ?? '').toString().trim();
                const cb = (b.metadata?.caseNumber ?? '').toString().trim();
                if (!ca && !cb) return 0;
                if (!ca) return 1;
                if (!cb) return -1;
                return ca.localeCompare(cb, undefined, { numeric: true });
            });
            sorted_audits.forEach((a) => {
                const li = ctx.Helpers.create_element('li', { class_name: 'audit-list-item audit-audit-item' });
                const actor_name = a.metadata?.actorName || '';
                const display_name = actor_name || `Granskning ${a.id}`;
                const case_number = a.metadata?.caseNumber || '';
                const case_span = ctx.Helpers.create_element('span', {
                    text_content: case_number ? `${case_number} ` : '',
                    class_name: 'audit-audit-case-number'
                });
                const audit_link_text = case_number ? `${case_number} ${display_name}` : display_name;
                const link = ctx.Helpers.create_element('a', {
                    text_content: display_name,
                    class_name: 'audit-item-label audit-audit-link',
                    attributes: {
                        href: `#audit_overview?auditId=${a.id}`,
                        'aria-label': t('backup_overview_link_to_audit_aria', { name: display_name })
                    }
                });
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    ctx.handle_open_audit(a.id);
                });
                const delete_aria = t('audit_delete_audit_aria', { name: audit_link_text });
                const download_aria = t('audit_download_audit_aria', { name: audit_link_text });
                const icon_svg_li = (name, size = 16) => (ctx.Helpers.get_icon_svg ? ctx.Helpers.get_icon_svg(name, ['currentColor'], size) : '');
                const download_parts = create_file_download_button({
                    Helpers: ctx.Helpers,
                    label: t('audit_download_label'),
                    t,
                    variant: 'button-default',
                    icon_name: 'save',
                    extra_class_names: ['audit-download-btn'],
                    aria_label: download_aria,
                    on_download: () => Promise.resolve(ctx.handle_download_audit(a.id)),
                });
                const delete_btn = ctx.Helpers.create_element('button', {
                    class_name: ['button', 'button-danger', 'button-small', 'audit-delete-btn'],
                    html_content: `<span>${t('delete')}</span>` + icon_svg_li('delete'),
                    attributes: { type: 'button', 'aria-label': delete_aria }
                });
                delete_btn.addEventListener('click', () => {
                    ctx.handle_delete_audit_click(a.id, audit_link_text, delete_btn);
                });
                const btn_group = ctx.Helpers.create_element('div', { class_name: 'audit-audit-item-actions' });
                btn_group.appendChild(download_parts.wrapper);
                btn_group.appendChild(delete_btn);
                li.appendChild(case_span);
                li.appendChild(link);
                li.appendChild(btn_group);
                audits_list.appendChild(li);
            });
        }
        right_col.appendChild(audits_list);
    }
    return right_col;
}
