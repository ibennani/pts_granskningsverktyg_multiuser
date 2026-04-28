// js/components/audit_view/AuditHeaderSection.js
// Bygger header: titel, filter (vid audits), filuppladdning, knapp "Starta ny granskning".

export function render_audit_header(ctx) {
    const t = ctx.get_t_func();
    const header_class_name = ctx.audit_mode === 'audits'
        ? ['audit-header', 'audit-header--with-filter']
        : 'audit-header';
    const header = ctx.Helpers.create_element('div', { class_name: header_class_name });
    const title_text = ctx.audit_mode === 'rules' ? t('audit_title_rules') : ctx.audit_mode === 'audits' ? t('audit_title_audits') : t('audit_title');
    const title = ctx.Helpers.create_element('h1', { text_content: title_text });
    header.appendChild(title);
    if (ctx.audit_mode === 'audits') {
        const filter_wrapper = ctx.Helpers.create_element('div', { class_name: 'audit-filter-wrapper' });

        const row = ctx.Helpers.create_element('div', { class_name: 'audit-filter-row form-group' });

        const text_field = ctx.Helpers.create_element('div', { class_name: ['audit-filter-row__field', 'audit-filter-row__field--text'] });
        const filter_label = ctx.Helpers.create_element('label', { attributes: { for: 'audit-filter-input' } });
        const filter_label_strong = ctx.Helpers.create_element('strong', { text_content: t('audit_filter_label') });
        filter_label.appendChild(filter_label_strong);
        const filter_input = ctx.Helpers.create_element('input', {
            class_name: ['audit-filter-input', 'form-control'],
            attributes: {
                id: 'audit-filter-input',
                type: 'text',
                name: 'audit-filter',
                value: ctx.audit_filter_query || ''
            }
        });
        filter_input.addEventListener('input', ctx.handle_filter_input);
        ctx._auditFilterInputRef = filter_input;
        text_field.appendChild(filter_label);
        text_field.appendChild(filter_input);

        const type_field = ctx.Helpers.create_element('div', { class_name: ['audit-filter-row__field', 'audit-filter-row__field--type'] });
        const type_label = ctx.Helpers.create_element('label', { attributes: { for: 'audit-type-filter-select' } });
        type_label.appendChild(
            ctx.Helpers.create_element('strong', { text_content: t('audit_type_filter_label') })
        );
        type_field.appendChild(type_label);
        const type_select = ctx.Helpers.create_element('select', {
            id: 'audit-type-filter-select',
            class_name: ['form-control', 'audit-type-filter-select']
        });
        const opts = [
            { value: '', label: t('audit_type_filter_all') },
            { value: 'webb', label: t('audit_type_filter_webb') },
            { value: 'pdf', label: t('audit_type_filter_pdf') }
        ];
        opts.forEach((o) => {
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

        row.appendChild(text_field);
        row.appendChild(type_field);
        filter_wrapper.appendChild(row);
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
        if (ctx.audit_mode === 'both') {
            const start_new_audit_btn = ctx.Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'audit-start-new-audit-btn'],
                text_content: t('start_new_audit'),
                attributes: { type: 'button', 'aria-label': t('start_new_audit') }
            });
            start_new_audit_btn.addEventListener('click', ctx.handle_start_new_audit);
            header.appendChild(start_new_audit_btn);
        }
    }
    return header;
}
