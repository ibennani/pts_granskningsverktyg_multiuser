// js/components/audit_view/AuditHeaderSection.js
// Bygger header: titel, filter (vid audits), filuppladdning, knapp "Starta ny granskning".

import { create_audit_filter_reset_button } from './audit_filter_reset_button.js';
import { render_audit_filter_search_and_accordion } from './audit_filter_accordion.js';
import { collect_granskningstyp_filter_options } from '../../logic/audit_list_section_filter.js';

function render_audit_page_size_field(ctx) {
    const t = ctx.get_t_func();
    const field = ctx.Helpers.create_element('div', {
        class_name: ['audit-filter-row__field', 'audit-filter-row__field--page-size']
    });
    const label = ctx.Helpers.create_element('label', { attributes: { for: 'audit-table-page-size-select' } });
    label.appendChild(ctx.Helpers.create_element('strong', { text_content: t('audit_table_page_size_label') }));
    field.appendChild(label);
    const sel = ctx.Helpers.create_element('select', {
        id: 'audit-table-page-size-select',
        class_name: ['form-control', 'dropdown-select', 'audit-filter-select', 'audit-page-size-select']
    });
    [
        { value: '5', label: t('audit_table_page_size_5') },
        { value: '10', label: t('audit_table_page_size_10') },
        { value: '25', label: t('audit_table_page_size_25') },
        { value: '50', label: t('audit_table_page_size_50') },
        { value: 'all', label: t('audit_table_page_size_all') }
    ].forEach((o) => {
        sel.appendChild(
            ctx.Helpers.create_element('option', {
                attributes: { value: o.value },
                text_content: o.label
            })
        );
    });
    const allowed_sizes = ['5', '10', '25', '50', 'all'];
    const stored = ctx.audit_table_page_size || 'all';
    if (!allowed_sizes.includes(stored)) {
        ctx.audit_table_page_size = 'all';
    }
    sel.value = ctx.audit_table_page_size;
    sel.addEventListener('change', ctx.handle_audit_table_page_size_change);
    ctx._auditPageSizeSelectRef = sel;
    field.appendChild(sel);
    return field;
}

function render_granskningstyp_filter_field(ctx, t) {
    const granskningstyp_options = collect_granskningstyp_filter_options(ctx.audits || []);

    const granskningstyp_field = ctx.Helpers.create_element('div', {
        class_name: ['audit-filter-row__field', 'audit-filter-row__field--granskningstyp']
    });
    const granskningstyp_label = ctx.Helpers.create_element('label', {
        attributes: { for: 'audit-granskningstyp-filter-select' }
    });
    granskningstyp_label.appendChild(
        ctx.Helpers.create_element('strong', { text_content: t('audit_granskningstyp_filter_label') })
    );
    granskningstyp_field.appendChild(granskningstyp_label);
    const granskningstyp_select = ctx.Helpers.create_element('select', {
        id: 'audit-granskningstyp-filter-select',
        class_name: [
            'form-control',
            'dropdown-select',
            'audit-filter-select',
            'audit-granskningstyp-filter-select'
        ],
        attributes: { name: 'audit-granskningstyp-filter' }
    });
    granskningstyp_select.appendChild(
        ctx.Helpers.create_element('option', {
            attributes: { value: '' },
            text_content: t('audit_granskningstyp_filter_all')
        })
    );
    granskningstyp_options.forEach((option_row) => {
        granskningstyp_select.appendChild(
            ctx.Helpers.create_element('option', {
                attributes: { value: option_row.id },
                text_content: option_row.label
            })
        );
    });
    granskningstyp_select.value = ctx.granskningstyp_filter || '';
    granskningstyp_select.addEventListener('change', ctx.handle_granskningstyp_filter_change);
    ctx._granskningstypSelectRef = granskningstyp_select;
    granskningstyp_field.appendChild(granskningstyp_select);
    return granskningstyp_field;
}

export function mount_audit_filter_secondary_fields(ctx, panel_inner) {
    if (!panel_inner || panel_inner.childElementCount > 0) return;
    const t = ctx.get_t_func();
    const fields_row = ctx.Helpers.create_element('div', {
        class_name: ['audit-filter-secondary-row', 'form-group']
    });

    fields_row.appendChild(render_granskningstyp_filter_field(ctx, t));

    const type_field = ctx.Helpers.create_element('div', {
        class_name: ['audit-filter-row__field', 'audit-filter-row__field--type']
    });
    const type_label = ctx.Helpers.create_element('label', { attributes: { for: 'audit-type-filter-select' } });
    type_label.appendChild(
        ctx.Helpers.create_element('strong', { text_content: t('audit_media_filter_label') })
    );
    type_field.appendChild(type_label);
    const type_select = ctx.Helpers.create_element('select', {
        id: 'audit-type-filter-select',
        class_name: ['form-control', 'dropdown-select', 'audit-filter-select', 'audit-type-filter-select'],
        attributes: { name: 'audit-type-filter' }
    });
    [
        { value: '', label: t('audit_type_filter_all') },
        { value: 'webb', label: t('audit_type_filter_webb') },
        { value: 'pdf', label: t('audit_type_filter_pdf') }
    ].forEach((o) => {
        type_select.appendChild(
            ctx.Helpers.create_element('option', {
                attributes: { value: o.value },
                text_content: o.label
            })
        );
    });
    type_select.value = ctx.audit_type_filter || '';
    type_select.addEventListener('change', ctx.handle_type_filter_change);
    ctx._auditTypeSelectRef = type_select;
    type_field.appendChild(type_select);
    fields_row.appendChild(type_field);

    const group_field = ctx.Helpers.create_element('div', {
        class_name: ['audit-filter-row__field', 'audit-filter-row__field--list-view', 'audit-list-view-mode-field']
    });
    const group_select_id = 'audit-list-view-mode-select';
    const group_label = ctx.Helpers.create_element('label', { attributes: { for: group_select_id } });
    group_label.appendChild(
        ctx.Helpers.create_element('strong', { text_content: t('audit_list_view_mode_label') })
    );
    const group_select = ctx.Helpers.create_element('select', {
        id: group_select_id,
        class_name: ['form-control', 'dropdown-select', 'audit-filter-select', 'audit-list-view-mode-select'],
        attributes: { name: 'audit-list-view-mode' }
    });
    [
        { value: 'all', label: t('audit_list_view_mode_all') },
        { value: 'mine', label: t('audit_list_view_mode_mine') },
        { value: 'case', label: t('audit_list_view_mode_grouped') },
        { value: 'auditor', label: t('audit_list_view_mode_grouped_auditor') }
    ].forEach((o) => {
        group_select.appendChild(
            ctx.Helpers.create_element('option', {
                attributes: { value: o.value },
                text_content: o.label
            })
        );
    });
    const valid_group_modes = ['all', 'mine', 'case', 'auditor'];
    group_select.value = valid_group_modes.includes(ctx.audit_list_group_mode)
        ? ctx.audit_list_group_mode
        : 'all';
    group_select.addEventListener('change', ctx.handle_audit_list_group_mode_change);
    ctx._auditGroupByCaseSelectRef = group_select;
    group_field.appendChild(group_label);
    group_field.appendChild(group_select);
    fields_row.appendChild(group_field);

    fields_row.appendChild(render_audit_page_size_field(ctx));

    const reset_field = ctx.Helpers.create_element('div', {
        class_name: ['audit-filter-row__field', 'audit-filter-row__field--reset']
    });
    reset_field.appendChild(create_audit_filter_reset_button(ctx));
    fields_row.appendChild(reset_field);

    panel_inner.appendChild(fields_row);
}

export function render_audit_header(ctx) {
    const t = ctx.get_t_func();
    const header_class_name = ctx.audit_mode === 'audits'
        ? ['audit-header', 'audit-header--with-filter']
        : 'audit-header';
    const header = ctx.Helpers.create_element('div', { class_name: header_class_name });
    const title_text = ctx.audit_mode === 'rules' ? t('audit_title_rules') : ctx.audit_mode === 'audits' ? t('audit_title_audits') : t('audit_title');
    const title = ctx.Helpers.create_element('h1', { text_content: title_text });
    header.appendChild(title);
    if (ctx.audit_mode === 'both') {
        const page_row = ctx.Helpers.create_element('div', { class_name: 'audit-header-page-size-row' });
        page_row.appendChild(render_audit_page_size_field(ctx));
        header.appendChild(page_row);
    }
    if (ctx.audit_mode === 'audits') {
        const filter_wrapper = ctx.Helpers.create_element('section', {
            class_name: 'audit-filter-wrapper',
            attributes: {
                id: 'audit-filter-region',
                'aria-label': t('audit_filter_landmark_label'),
                tabindex: '-1'
            }
        });
        if (ctx.audit_filter_panel_open) {
            filter_wrapper.classList.add('audit-filter-wrapper--open');
        }

        filter_wrapper.appendChild(
            render_audit_filter_search_and_accordion(ctx, filter_wrapper, (panel_inner) => {
                mount_audit_filter_secondary_fields(ctx, panel_inner);
            })
        );

        const live_region = ctx.Helpers.create_element('div', {
            class_name: 'visually-hidden',
            attributes: { role: 'status', 'aria-live': 'polite' }
        });
        ctx._auditFilterLiveRegionRef = live_region;
        filter_wrapper.appendChild(live_region);

        header.appendChild(filter_wrapper);
    }
    if (ctx.audit_mode !== 'audits') {
        ctx.upload_file_input = ctx.Helpers.create_element('input', {
            class_name: 'audit-hidden-file-input',
            attributes: {
                type: 'file',
                accept: '.json,application/json',
                'aria-label': t('audit_upload_rule'),
                tabindex: '-1',
                'aria-hidden': 'true'
            }
        });
        ctx.upload_file_input.addEventListener('change', ctx.handle_file_select);
        header.appendChild(ctx.upload_file_input);
    }
    return header;
}
