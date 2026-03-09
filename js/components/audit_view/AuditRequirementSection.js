// js/components/audit_view/AuditRequirementSection.js
// Bygger vänsterkolumnen: regelfiler (publicerade + arbetskopior).
import { create_rule_table_columns } from '../../utils/rule_table_columns.js';

export function render_audit_requirement_section(ctx) {
    const t = ctx.get_t_func();
    const left_col = ctx.Helpers.create_element('section', {
        class_name: 'start-view-audits-section',
        attributes: { 'aria-labelledby': 'audit-rules-heading' }
    });
    const rules_heading = ctx.Helpers.create_element('h2', {
        id: 'audit-rules-heading',
        text_content: t('audit_rules_title')
    });
    left_col.appendChild(rules_heading);

    const rules_table_wrapper = ctx.Helpers.create_element('div', {
        attributes: { id: 'audit-published-rules-wrapper' }
    });
    ctx._rulesTableSortState = ctx._rulesTableSortState ?? { columnIndex: 0, direction: 'asc' };
    const rules_table_deps = {
        t: ctx.get_t_func(),
        Helpers: ctx.Helpers,
        Translation: ctx.Translation,
        production_rules_with_base_ids: (ctx.production_rules || [])
            .map((r) => r.production_base_id)
            .filter((id) => !!id)
    };
    const rules_table_handlers = {
        onEditRule: (id) => ctx.handle_edit_rule(id),
        onDownloadRule: (id) => ctx.handle_download_rule(id),
        onDeleteRule: (id) => ctx.handle_delete_rule(id),
        onPublishRule: (id) => ctx.handle_publish_rule(id),
        onCopyRule: (id) => ctx.handle_copy_rule(id),
        onPublishProductionRule: (id) => ctx.handle_publish_production_rule(id)
    };
    const rule_columns = create_rule_table_columns(rules_table_deps, rules_table_handlers);
    ctx._publishedRulesTable?.render({
        root: rules_table_wrapper,
        columns: rule_columns,
        data: ctx.published_rules || [],
        emptyMessage: t('audit_rules_empty'),
        ariaLabel: t('audit_rules_title'),
        wrapperClassName: 'generic-table-wrapper',
        tableClassName: 'generic-table generic-table--audit-list',
        sortState: ctx._rulesTableSortState,
        onSort: (columnIndex, direction) => {
            ctx._rulesTableSortState = { columnIndex, direction };
            ctx.render();
        },
        t: ctx.Translation.t.bind(ctx.Translation),
        getRowId: (row) => row?.id
    });
    left_col.appendChild(rules_table_wrapper);

    const draft_section = ctx.Helpers.create_element('section', {
        class_name: 'start-view-audits-section start-view-audits-section-following',
        attributes: { 'aria-labelledby': 'audit-rules-draft-heading' }
    });
    const draft_heading_row = ctx.Helpers.create_element('div', { class_name: 'start-view-section-heading-row' });
    const draft_rules_heading = ctx.Helpers.create_element('h2', {
        id: 'audit-rules-draft-heading',
        text_content: t('audit_rules_draft_title')
    });
    draft_heading_row.appendChild(draft_rules_heading);

    if (ctx.audit_mode !== 'audits') {
        const upload_rule_btn = ctx.Helpers.create_element('button', {
            class_name: ['button', 'button-primary', 'audit-upload-btn'],
            html_content: `<span>${t('audit_upload_saved_rule')}</span>` + (ctx.Helpers.get_icon_svg ? ctx.Helpers.get_icon_svg('upload_file') : ''),
            attributes: { type: 'button', 'aria-label': t('audit_upload_saved_rule') }
        });
        upload_rule_btn.addEventListener('click', ctx.handle_upload_click);
        draft_heading_row.appendChild(upload_rule_btn);

        const create_rule_btn = ctx.Helpers.create_element('button', {
            class_name: ['button', 'button-default', 'audit-create-rule-btn'],
            html_content: `<span>${t('audit_create_new_rule')}</span>` + (ctx.Helpers.get_icon_svg ? ctx.Helpers.get_icon_svg('add') : ''),
            attributes: { type: 'button', 'aria-label': t('audit_create_new_rule') }
        });
        create_rule_btn.addEventListener('click', ctx.handle_create_new_rule.bind(ctx));
        draft_heading_row.appendChild(create_rule_btn);
    }

    draft_section.appendChild(draft_heading_row);

    const draft_rules_table_wrapper = ctx.Helpers.create_element('div', {
        attributes: { id: 'audit-draft-rules-wrapper' }
    });
    ctx._draftRulesTableSortState = ctx._draftRulesTableSortState ?? { columnIndex: 0, direction: 'asc' };
    ctx._draftRulesTable?.render({
        root: draft_rules_table_wrapper,
        columns: rule_columns,
        data: ctx.production_rules || [],
        emptyMessage: t('audit_rules_draft_empty') || '',
        ariaLabel: t('audit_rules_draft_title'),
        wrapperClassName: 'generic-table-wrapper',
        tableClassName: 'generic-table generic-table--audit-list',
        sortState: ctx._draftRulesTableSortState,
        onSort: (columnIndex, direction) => {
            ctx._draftRulesTableSortState = { columnIndex, direction };
            ctx.render();
        },
        t: ctx.Translation.t.bind(ctx.Translation),
        getRowId: (row) => row?.id
    });
    draft_section.appendChild(draft_rules_table_wrapper);
    left_col.appendChild(draft_section);

    return left_col;
}
