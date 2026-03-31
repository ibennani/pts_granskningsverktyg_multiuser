/**
 * Obligatoriska metadatafält och modal för saknade värden vid sparning av regelfil.
 * @module js/components/rulefile_metadata/rulefile_metadata_validation
 */

export const REQUIRED_METADATA_FIELDS = [
    { name: 'metadata.title', labelKey: 'rulefile_metadata_field_title' },
    { name: 'metadata.description', labelKey: 'rulefile_metadata_field_description' },
    { name: 'metadata.language', labelKey: 'rulefile_metadata_field_language' },
    { name: 'metadata.monitoringType.text', labelKey: 'rulefile_metadata_field_monitoring_type_label' },
    { name: 'metadata.publisher.name', labelKey: 'rulefile_metadata_field_publisher_name' },
    { name: 'metadata.publisher.contactPoint', labelKey: 'rulefile_metadata_field_publisher_contact' },
    { name: 'metadata.source.url', labelKey: 'rulefile_metadata_field_source_url' },
    { name: 'metadata.source.title', labelKey: 'rulefile_metadata_field_source_title' }
];

/**
 * @param {FormData} formData
 * @returns {Array<{ name: string, labelKey: string }>}
 */
export function collect_missing_required_metadata_fields(formData) {
    const fields = Array.isArray(REQUIRED_METADATA_FIELDS) ? REQUIRED_METADATA_FIELDS : [];
    const missing = [];
    fields.forEach((field) => {
        const raw = formData.get(field.name);
        const value = (raw || '').toString().trim();
        if (!value) {
            missing.push(field);
        }
    });
    return missing;
}

/**
 * @param {{ Helpers: object, Translation: object, NotificationComponent?: object }} ctx
 * @param {Array<{ name: string, labelKey: string }>} missingFields
 * @param {HTMLFormElement} form
 * @param {string|null} focusFieldName
 */
export function show_rulefile_required_fields_modal(ctx, missingFields, form, focusFieldName) {
    const ModalComponent = window.ModalComponent;
    const { Helpers, Translation, NotificationComponent } = ctx;
    const t = Translation.t;
    if (!ModalComponent?.show || !Helpers?.create_element) {
        const labels = (missingFields || []).map((f) => t(f.labelKey || '')).join(', ');
        if (NotificationComponent?.show_global_message) {
            NotificationComponent.show_global_message(
                `${t('rulefile_metadata_required_modal_title')}: ${labels}`,
                'error'
            );
        }
        const el = focusFieldName ? form.elements[focusFieldName] : null;
        if (el && typeof el.focus === 'function') {
            try {
                el.focus();
            } catch (_) {
                // ignoreras medvetet
            }
        }
        return;
    }

    const intro = t('rulefile_metadata_required_modal_intro');
    let message_html = '';
    if (intro) {
        const safe_intro = Helpers.escape_html ? Helpers.escape_html(intro) : intro;
        message_html += `<p>${safe_intro}</p>`;
    }
    if (Array.isArray(missingFields) && missingFields.length > 0) {
        message_html += '<ul>';
        missingFields.forEach((field) => {
            const labelText = t(field.labelKey || '');
            const safeLabel = Helpers.escape_html ? Helpers.escape_html(labelText) : labelText;
            message_html += `<li>${safeLabel}</li>`;
        });
        message_html += '</ul>';
    }

    ModalComponent.show(
        {
            h1_text: t('rulefile_metadata_required_modal_title'),
            message_text: ''
        },
        (container, modal_instance) => {
            const message_el = container.querySelector('.modal-message');
            if (message_el) {
                message_el.innerHTML = message_html;
            }
            const buttons_wrapper = Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
            const ok_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                attributes: { type: 'button' },
                text_content: t('rulefile_metadata_required_modal_acknowledge')
            });
            ok_btn.addEventListener('click', () => {
                modal_instance.close();
                const el = focusFieldName ? form.elements[focusFieldName] : null;
                if (el && typeof el.focus === 'function') {
                    try {
                        el.focus();
                    } catch (_) {
                        // ignoreras medvetet
                    }
                }
            });
            buttons_wrapper.appendChild(ok_btn);
            container.appendChild(buttons_wrapper);
        }
    );
}
