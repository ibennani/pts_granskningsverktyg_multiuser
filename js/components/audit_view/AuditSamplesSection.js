// js/components/audit_view/AuditSamplesSection.js
// Bygger högerkolumnen: granskningar (listor eller sektioner beroende på audit_mode).

export function render_audit_samples_section(ctx) {
    const t = ctx.get_t_func();
    const right_col = ctx.Helpers.create_element(
        ctx.audit_mode === 'audits' ? 'div' : 'section',
        ctx.audit_mode === 'audits'
            ? {}
            : { class_name: 'audit-column', attributes: { 'aria-labelledby': 'audit-audits-heading' } }
    );

    if (ctx.audit_mode === 'audits') {
        const sort_audits = (list) => [...list].sort((a, b) => {
            const ca = (a.metadata?.caseNumber ?? '').toString().trim();
            const cb = (b.metadata?.caseNumber ?? '').toString().trim();
            if (!ca && !cb) return 0;
            if (!ca) return 1;
            if (!cb) return -1;
            return ca.localeCompare(cb, undefined, { numeric: true });
        });
        const query_raw = ctx.audit_filter_query || '';
        const query = query_raw.trim().toLowerCase();
        const filter_and_sort_audits = (list) => {
            if (!query) return sort_audits(list);
            const filtered = list.filter((a) => {
                const meta = a.metadata || {};
                const case_number = (meta.caseNumber ?? '').toString().trim().toLowerCase();
                const actor_name = (meta.actorName ?? '').toString().trim().toLowerCase();
                const combined = `${case_number} ${actor_name}`.trim();
                if (!combined) return false;
                return combined.includes(query);
            });
            return sort_audits(filtered);
        };
        const base_in_progress = ctx.audits.filter((a) => a.status === 'in_progress');
        const base_not_started = ctx.audits.filter((a) => a.status === 'not_started');
        const base_locked = ctx.audits.filter((a) => a.status === 'locked');
        const base_archived = ctx.audits.filter((a) => a.status === 'archived');
        const in_progress = filter_and_sort_audits(base_in_progress);
        const not_started = filter_and_sort_audits(base_not_started);
        const completed = filter_and_sort_audits(base_locked);
        const archived_audits = filter_and_sort_audits(base_archived);
        const section_configs = [
            { heading_key: 'start_view_audits_heading', audits: in_progress },
            { heading_key: 'start_view_new_audits_heading', audits: not_started },
            { heading_key: 'start_view_completed_audits_heading', audits: completed },
            { heading_key: 'start_view_archived_audits_heading', audits: archived_audits }
        ];
        const has_filter = !!query;
        const visible_section_configs = has_filter
            ? section_configs.filter((config) => (config.audits || []).length > 0)
            : section_configs;
        right_col.classList.add('audit-audits-sections-container');

        visible_section_configs.forEach((config, index) => {
            const section = ctx.Helpers.create_element('section', {
                class_name: index === 0 ? 'start-view-audits-section' : 'start-view-audits-section start-view-audits-section-following',
                attributes: { 'aria-labelledby': `${config.heading_key}-heading` }
            });
            const heading_row = ctx.Helpers.create_element('div', { class_name: 'start-view-section-heading-row' });
            const heading_title = t(config.heading_key);
            const section_heading_text = t('start_view_section_heading_with_count', {
                title: heading_title,
                count: (config.audits || []).length
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
            const empty_key =
                config.heading_key === 'start_view_audits_heading'
                    ? 'start_view_no_audits'
                    : config.heading_key === 'start_view_new_audits_heading'
                        ? 'start_view_no_new_audits'
                        : config.heading_key === 'start_view_archived_audits_heading'
                            ? 'start_view_no_archived_audits'
                            : 'start_view_no_completed_audits';
            const sort_state_key =
                config.heading_key === 'start_view_audits_heading'
                    ? '_inProgressTableSortState'
                    : config.heading_key === 'start_view_new_audits_heading'
                        ? '_newTableSortState'
                        : config.heading_key === 'start_view_archived_audits_heading'
                            ? '_archivedTableSortState'
                            : '_completedTableSortState';
            ctx[sort_state_key] = ctx[sort_state_key] ?? { columnIndex: 0, direction: 'asc' };
            ctx._auditListComponent.render({
                root: table_wrapper,
                audits: config.audits,
                emptyMessage: t(empty_key),
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
            section.appendChild(table_wrapper);
            right_col.appendChild(section);
        });
        if (has_filter && visible_section_configs.length === 0) {
            const no_results = ctx.Helpers.create_element('p', {
                class_name: 'audit-filter-no-results',
                text_content: t('audit_filter_no_results')
            });
            right_col.appendChild(no_results);
        }
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
                const download_btn = ctx.Helpers.create_element('button', {
                    class_name: ['button', 'button-default', 'button-small', 'audit-download-btn'],
                    html_content: `<span>${t('audit_download_label')}</span>` + icon_svg_li('save'),
                    attributes: { type: 'button', 'aria-label': download_aria }
                });
                download_btn.addEventListener('click', () => ctx.handle_download_audit(a.id));
                const delete_btn = ctx.Helpers.create_element('button', {
                    class_name: ['button', 'button-danger', 'button-small', 'audit-delete-btn'],
                    html_content: `<span>${t('delete')}</span>` + icon_svg_li('delete'),
                    attributes: { type: 'button', 'aria-label': delete_aria }
                });
                delete_btn.addEventListener('click', () => {
                    ctx.handle_delete_audit_click(a.id, audit_link_text, delete_btn);
                });
                const btn_group = ctx.Helpers.create_element('div', { class_name: 'audit-audit-item-actions' });
                btn_group.appendChild(download_btn);
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
