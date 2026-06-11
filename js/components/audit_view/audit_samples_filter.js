/**
 * @fileoverview Filtrering och inkrementell uppdatering av granskningslistor i AuditSamplesSection.
 */

import { enrich_audits_with_live_progress } from '../../logic/audit_list_progress.js';
import { filter_text_matches } from '../../utils/string_filter_normalize.js';

const SECTION_HEADING_KEYS = [
    'start_view_audits_heading',
    'start_view_new_audits_heading',
    'start_view_completed_audits_heading',
    'start_view_archived_audits_heading'
];

function sort_audits(list) {
    return [...list].sort((a, b) => {
        const ca = (a.metadata?.caseNumber ?? '').toString().trim();
        const cb = (b.metadata?.caseNumber ?? '').toString().trim();
        if (!ca && !cb) return 0;
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb, undefined, { numeric: true });
    });
}

/**
 * @param {object} ctx AuditViewComponent-instans
 * @returns {{ query_raw: string, has_filter: boolean, section_configs: Array<{ heading_key: string, audits: unknown[] }> }}
 */
export function build_audit_list_section_configs(ctx) {
    const query_raw = ctx.audit_filter_query || '';
    const filter_and_sort_audits = (list) => {
        if (!query_raw.trim()) return sort_audits(list);
        const filtered = list.filter((a) => {
            const meta = a.metadata || {};
            const case_number = (meta.caseNumber ?? '').toString().trim();
            const actor_name = (meta.actorName ?? '').toString().trim();
            const auditor_name = (meta.auditorName ?? '').toString().trim();
            const combined = `${case_number} ${actor_name} ${auditor_name}`.trim();
            if (!combined) return false;
            return filter_text_matches(combined, query_raw);
        });
        return sort_audits(filtered);
    };
    const section_configs = [
        { heading_key: 'start_view_audits_heading', audits: filter_and_sort_audits(ctx.audits.filter((a) => a.status === 'in_progress')) },
        { heading_key: 'start_view_new_audits_heading', audits: filter_and_sort_audits(ctx.audits.filter((a) => a.status === 'not_started')) },
        { heading_key: 'start_view_completed_audits_heading', audits: filter_and_sort_audits(ctx.audits.filter((a) => a.status === 'locked')) },
        { heading_key: 'start_view_archived_audits_heading', audits: filter_and_sort_audits(ctx.audits.filter((a) => a.status === 'archived')) }
    ];
    return {
        query_raw,
        has_filter: !!query_raw.trim(),
        section_configs
    };
}

export function get_audit_sort_state_key(heading_key) {
    if (heading_key === 'start_view_audits_heading') return '_inProgressTableSortState';
    if (heading_key === 'start_view_new_audits_heading') return '_newTableSortState';
    if (heading_key === 'start_view_archived_audits_heading') return '_archivedTableSortState';
    return '_completedTableSortState';
}

export function get_audit_empty_message_key(heading_key) {
    if (heading_key === 'start_view_audits_heading') return 'start_view_no_audits';
    if (heading_key === 'start_view_new_audits_heading') return 'start_view_no_new_audits';
    if (heading_key === 'start_view_archived_audits_heading') return 'start_view_no_archived_audits';
    return 'start_view_no_completed_audits';
}

export function build_section_heading_text(t, config) {
    const heading_title = t(config.heading_key);
    return t('start_view_section_heading_with_count', {
        title: heading_title,
        count: (config.audits || []).length
    });
}

export function clear_audit_table_focus_for_filter(ctx) {
    const filter_input = document.getElementById('audit-filter-input');
    const filter_had_focus = filter_input && document.activeElement === filter_input;
    if (filter_had_focus && ctx._auditListComponent?._table) {
        ctx._auditListComponent._table._lastFocusPosition = null;
        ctx._auditListComponent._table._pendingSortFocusIndex = undefined;
    }
}

export function render_audit_section_table(ctx, config, table_wrapper, section_heading_text, t) {
    const sort_state_key = get_audit_sort_state_key(config.heading_key);
    ctx[sort_state_key] = ctx[sort_state_key] ?? { columnIndex: 0, direction: 'asc' };
    const live_state = typeof ctx.getState === 'function' ? ctx.getState() : null;
    const audits_for_table = enrich_audits_with_live_progress(config.audits, live_state);
    ctx._auditListComponent.render({
        root: table_wrapper,
        audits: audits_for_table,
        emptyMessage: t(get_audit_empty_message_key(config.heading_key)),
        ariaLabel: section_heading_text,
        includeDelete: true,
        sortState: ctx[sort_state_key],
        onSort: (columnIndex, direction) => {
            ctx[sort_state_key] = { columnIndex, direction };
            ctx.render();
        },
        onOpenAudit: (id) => ctx.handle_open_audit(id),
        onDownloadAudit: (id) => ctx.handle_download_audit(id),
        onDeleteAudit: (id, displayName, deleteButton) => ctx.handle_delete_audit_click(id, displayName, deleteButton),
        get_status_label: ctx.get_status_label.bind(ctx)
    });
}

export function sync_audit_section_following_classes(container) {
    const sections = container.querySelectorAll('[data-audit-section-key]');
    let first_visible = true;
    sections.forEach((section) => {
        if (section.hidden) return;
        section.classList.remove('start-view-audits-section', 'start-view-audits-section-following');
        if (first_visible) {
            section.classList.add('start-view-audits-section');
            first_visible = false;
            return;
        }
        section.classList.add('start-view-audits-section', 'start-view-audits-section-following');
    });
}

function section_dom_is_ready(container) {
    return SECTION_HEADING_KEYS.every(
        (heading_key) => container.querySelector(`[data-audit-section-key="${heading_key}"]`)
    );
}

function update_audit_filter_no_results(ctx, container, has_filter, visible_section_count, t) {
    let no_results = container.querySelector('.audit-filter-no-results');
    const show_no_results = has_filter && visible_section_count === 0;
    if (show_no_results) {
        if (!no_results) {
            no_results = ctx.Helpers.create_element('p', {
                class_name: 'audit-filter-no-results',
                text_content: t('audit_filter_no_results')
            });
            container.appendChild(no_results);
            return;
        }
        no_results.hidden = false;
        return;
    }
    if (no_results) {
        no_results.hidden = true;
    }
}

/**
 * Uppdaterar befintliga sektioner: h2-räknare, synlighet och tabellinnehåll – utan att rita om header eller knappar.
 * @returns {boolean} false om containern saknar förväntad struktur (anroparen ska bygga om sektionen).
 */
export function update_audit_samples_filter(ctx, container) {
    if (!container || ctx.audit_mode !== 'audits' || !section_dom_is_ready(container)) {
        return false;
    }

    const t = ctx.get_t_func();
    const { has_filter, section_configs } = build_audit_list_section_configs(ctx);
    clear_audit_table_focus_for_filter(ctx);

    let visible_section_count = 0;
    section_configs.forEach((config) => {
        const section = container.querySelector(`[data-audit-section-key="${config.heading_key}"]`);
        const visible = !has_filter || (config.audits || []).length > 0;
        section.hidden = !visible;
        if (visible) visible_section_count += 1;

        const heading = section.querySelector(`#${CSS.escape(`${config.heading_key}-heading`)}`);
        const section_heading_text = build_section_heading_text(t, config);
        if (heading) {
            heading.textContent = section_heading_text;
        }

        const table_wrapper = section.querySelector('.audit-section-table-wrapper');
        if (visible && table_wrapper) {
            render_audit_section_table(ctx, config, table_wrapper, section_heading_text, t);
        }
    });

    sync_audit_section_following_classes(container);
    update_audit_filter_no_results(ctx, container, has_filter, visible_section_count, t);
    return true;
}
