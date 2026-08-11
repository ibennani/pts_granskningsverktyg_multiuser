/**
 * @fileoverview Granskningsinformation under Åtgärder (flyttad från Inställningar).
 */
import { MetadataFormComponent } from './MetadataFormComponent.js';
import { audit_metadata_granskningstyp_display_label } from '../utils/audit_type_display_label.js';

export type AuditActionsInformationRenderDeps = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

type MetadataAuditorOption = { value: string; label: string };
type MetadataCaseHandlerOption = { value: string; label: string };

export function render_audit_actions_information_section(
    deps: AuditActionsInformationRenderDeps,
    plate: HTMLElement,
    options: {
        state: Record<string, unknown>;
        readonly: boolean;
        status: string;
        metadata_container_ref: { current: HTMLElement | null };
        full_deps: Record<string, unknown>;
        handlers: {
            on_metadata_submit: (form_data: Record<string, unknown>) => void | Promise<void>;
            on_back: () => void;
        };
        auditorNameOptions?: MetadataAuditorOption[];
        caseHandlerOptions?: MetadataCaseHandlerOption[];
    }
): void {
    const { Helpers: helpers, Translation: { t } } = deps;
    const {
        state,
        readonly,
        status,
        metadata_container_ref,
        full_deps,
        handlers,
        auditorNameOptions = [],
        caseHandlerOptions = [],
    } = options;

    plate.appendChild(
        helpers.create_element('h1', { text_content: t('audit_actions_information_title') })
    );
    plate.appendChild(
        helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('audit_actions_information_intro'),
        })
    );

    const metadata_section = helpers.create_element('section', {
        class_name: 'audit-settings__metadata-section',
    });

    if (readonly) {
        const md = (state.auditMetadata || {}) as Record<string, string>;
        const rf_meta = (
            (state.ruleFileContent as { metadata?: { monitoringType?: { text?: string; label?: string } } } | null)
                ?.metadata || {}
        );
        const readonly_list = helpers.create_element('dl', {
            class_name: 'audit-settings__readonly-metadata',
        });
        const add_row = (label_key: string, value: string) => {
            if (!value) return;
            readonly_list.appendChild(helpers.create_element('dt', { text_content: t(label_key) }));
            readonly_list.appendChild(helpers.create_element('dd', { text_content: value }));
        };
        add_row(
            'rulefile_metadata_field_monitoring_type_label',
            rf_meta.monitoringType?.text || rf_meta.monitoringType?.label || ''
        );
        add_row(
            'metadata_audit_type_question_label',
            audit_metadata_granskningstyp_display_label(md, state.ruleFileContent)
        );
        add_row('case_number', md.caseNumber || '');
        add_row('actor_name', md.actorName || '');
        add_row('actor_link', md.actorLink || '');
        add_row('auditor_name', md.auditorName || '');
        add_row('case_handler', md.caseHandler || '');
        metadata_section.appendChild(readonly_list);
    } else {
        metadata_container_ref.current = helpers.create_element('div', {
            id: 'audit-actions-metadata-form',
        });
        metadata_section.appendChild(metadata_container_ref.current);

        MetadataFormComponent.init({
            root: metadata_container_ref.current,
            deps: full_deps,
            options: {
                onSubmit: handlers.on_metadata_submit,
                onCancel: handlers.on_back,
            },
        });

        const md = (state.auditMetadata || {}) as Record<string, string>;
        MetadataFormComponent.render({
            initialData: md,
            submitButtonText: t('audit_actions_information_save'),
            cancelButtonText: t('audit_actions_back_to_hub'),
            showStartDate: status === 'in_progress' || status === 'locked' || status === 'archived',
            showEndDate: status === 'locked' || status === 'archived',
            effectiveStartIso: (state.startTime as string) || md.startTime || null,
            ruleFileContent: state.ruleFileContent,
            auditStatus: status,
            monitoringTypeConfirmed: true,
            auditorNameOptions,
            caseHandlerOptions,
        });
    }

    plate.appendChild(metadata_section);

    const back_row = helpers.create_element('div', { class_name: 'audit-settings__back-row' });
    const back_btn = helpers.create_element('button', {
        class_name: ['button', 'button-default'],
        attributes: { type: 'button' },
        text_content: t('audit_actions_back_to_hub'),
    });
    back_btn.addEventListener('click', handlers.on_back);
    back_row.appendChild(back_btn);
    plate.appendChild(back_row);
}
