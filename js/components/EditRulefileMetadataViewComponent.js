// js/components/EditRulefileMetadataViewComponent.js
import { clone_metadata, ensure_metadata_defaults } from '../logic/rulefile_metadata_model.js';
import { handle_submit_create, handle_submit } from '../logic/rulefile_metadata_submit.js';
import { create_field, create_language_select_field } from './rulefile_metadata/rulefile_metadata_form_fields.js';
import {
    renderContentTypesEditor,
    renderPageTypesEditor,
    renderTaxonomiesEditor
} from './rulefile_metadata/rulefile_metadata_page_content_editors.js';
import {
    renderSampleCategoriesEditor,
    renderSampleTypesEditor
} from './rulefile_metadata/rulefile_metadata_sample_editors.js';
import { create_report_template_section } from './rulefile_metadata/rulefile_metadata_report_template.js';
import './edit_rulefile_metadata_view.css';

export class EditRulefileMetadataViewComponent {
    constructor() {
        this.CSS_PATH = './edit_rulefile_metadata_view.css';
        this.root = null;
        this.deps = null;
        this.params = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.params = deps.params || {};
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;

        if (this.Helpers?.load_css) {
            await this.Helpers.load_css(this.CSS_PATH).catch(err => { if (window.ConsoleManager) window.ConsoleManager.warn('[EditRulefileMetadataView] Failed to load CSS', err); });
        }
    }

    _create_form(metadata, is_create_mode = false) {
        const workingMetadata = is_create_mode
            ? clone_metadata(metadata)
            : ensure_metadata_defaults(clone_metadata(metadata));
        const form = this.Helpers.create_element('form', { class_name: 'rulefile-metadata-edit-form' });
        const ctx = { Helpers: this.Helpers, Translation: this.Translation };

        const general_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        general_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_general') }));
        general_section.appendChild(create_field(ctx, 'rulefile_metadata_field_title', 'metadata.title', metadata.title || '', 'text'));
        general_section.appendChild(create_field(ctx, 'rulefile_metadata_field_description', 'metadata.description', metadata.description || '', 'textarea'));
        if (!is_create_mode) {
            general_section.appendChild(create_field(ctx, 'rulefile_metadata_field_version', 'metadata.version', metadata.version || ''));
        }
        const initial_language =
            metadata.language ||
            (this.Translation?.get_current_language_code && this.Translation.get_current_language_code()) ||
            (window.Translation?.get_current_language_code && window.Translation.get_current_language_code()) ||
            '';
        general_section.appendChild(create_language_select_field(ctx, 'metadata.language', initial_language));
        if (!is_create_mode) {
            general_section.appendChild(create_field(ctx, 'rulefile_metadata_field_monitoring_type_key', 'metadata.monitoringType.type', metadata.monitoringType?.type || ''));
        }
        general_section.appendChild(create_field(ctx, 'rulefile_metadata_field_monitoring_type_label', 'metadata.monitoringType.text', metadata.monitoringType?.text || ''));
        if (!is_create_mode) {
            general_section.appendChild(create_field(ctx, 'rulefile_metadata_field_date_created', 'metadata.dateCreated', metadata.dateCreated || '', 'date'));
            general_section.appendChild(create_field(ctx, 'rulefile_metadata_field_date_modified', 'metadata.dateModified', metadata.dateModified || '', 'date'));
            general_section.appendChild(create_field(ctx, 'rulefile_metadata_field_license', 'metadata.license', metadata.license || ''));
        }

        const publisher_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        publisher_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_publisher') }));
        publisher_section.appendChild(create_field(ctx, 'rulefile_metadata_field_publisher_name', 'metadata.publisher.name', metadata.publisher?.name || ''));
        publisher_section.appendChild(create_field(ctx, 'rulefile_metadata_field_publisher_contact', 'metadata.publisher.contactPoint', metadata.publisher?.contactPoint || ''));

        const source_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        source_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_source') }));
        source_section.appendChild(create_field(ctx, 'rulefile_metadata_field_source_url', 'metadata.source.url', metadata.source?.url || '', 'url'));
        source_section.appendChild(create_field(ctx, 'rulefile_metadata_field_source_title', 'metadata.source.title', metadata.source?.title || ''));
        if (!is_create_mode) {
            source_section.appendChild(create_field(ctx, 'rulefile_metadata_field_source_retrieved', 'metadata.source.retrievedDate', metadata.source?.retrievedDate || '', 'date'));
            source_section.appendChild(create_field(ctx, 'rulefile_metadata_field_source_format', 'metadata.source.format', metadata.source?.format || ''));
        }

        if (is_create_mode) {
            form.append(general_section, publisher_section, source_section);
            form.addEventListener('submit', event => {
                event.preventDefault();
                handle_submit_create({
                    form,
                    Translation: this.Translation,
                    Helpers: this.Helpers,
                    NotificationComponent: this.NotificationComponent,
                    getState: this.getState,
                    dispatch: this.dispatch,
                    StoreActionTypes: this.StoreActionTypes,
                    router: this.router
                });
            });
            const footerActions = this.Helpers.create_element('div', { class_name: 'metadata-edit-form-footer-actions' });
            const footerSaveButton = this.Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                attributes: { type: 'button' },
                html_content: `<span>${this.Translation.t('rulefile_metadata_save_metadata')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
            });
            footerSaveButton.addEventListener('click', () => form.requestSubmit());

            const footerCancelButton = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                attributes: { type: 'button' },
                html_content: `<span>${this.Translation.t('back_without_saving')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('arrow_back') : '')
            });
            footerCancelButton.addEventListener('click', () => this.router('audit_rules'));

            footerActions.append(footerSaveButton, footerCancelButton);
            form.appendChild(footerActions);

            return { form, workingMetadata };
        }

        const keywords_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        keywords_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_keywords') }));
        const keywords_text = Array.isArray(metadata.keywords) ? metadata.keywords.join('\n') : '';
        const keywords_field = create_field(ctx, 'rulefile_metadata_field_keywords', 'metadata.keywords', keywords_text, 'textarea');
        keywords_field.appendChild(this.Helpers.create_element('p', {
            class_name: 'field-hint',
            text_content: this.Translation.t('rulefile_metadata_field_keywords_hint')
        }));
        keywords_section.appendChild(keywords_field);

        const page_types_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        page_types_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_page_types') }));
        const page_types_body = this.Helpers.create_element('div', { class_name: 'editable-list-container' });
        page_types_section.appendChild(page_types_body);
        renderPageTypesEditor(ctx, page_types_body, workingMetadata);

        const content_types_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        content_types_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_content_types') }));
        const content_types_body = this.Helpers.create_element('div', { class_name: 'editable-card-list' });
        content_types_section.appendChild(content_types_body);
        renderContentTypesEditor(ctx, content_types_body, workingMetadata);

        const samples_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        samples_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_samples') }));
        samples_section.appendChild(this.Helpers.create_element('h3', { text_content: this.Translation.t('rulefile_metadata_sample_categories_title') }));
        const sample_categories_body = this.Helpers.create_element('div', { class_name: 'editable-card-list' });
        samples_section.appendChild(sample_categories_body);
        renderSampleCategoriesEditor(ctx, sample_categories_body, workingMetadata);
        samples_section.appendChild(this.Helpers.create_element('h3', { text_content: this.Translation.t('rulefile_metadata_sample_types_title') }));
        const sample_types_body = this.Helpers.create_element('div', { class_name: 'editable-list-container' });
        samples_section.appendChild(sample_types_body);
        renderSampleTypesEditor(ctx, sample_types_body, workingMetadata);

        const taxonomies_section = this.Helpers.create_element('section', { class_name: 'form-section' });
        taxonomies_section.appendChild(this.Helpers.create_element('h2', { text_content: this.Translation.t('rulefile_metadata_section_taxonomies') }));
        const taxonomies_body = this.Helpers.create_element('div', { class_name: 'editable-card-list' });
        taxonomies_section.appendChild(taxonomies_body);
        renderTaxonomiesEditor(ctx, taxonomies_body, workingMetadata);

        // Report Template Sections (if reportTemplate exists in ruleFileContent)
        const current_state = this.getState();
        const rule_file_content = current_state?.ruleFileContent || {};
        const report_template = rule_file_content.reportTemplate || { sections: {} };
        // Ensure reportTemplate.sections exists
        if (!report_template.sections) {
            report_template.sections = {};
        }
        const report_sections_section = create_report_template_section(ctx, report_template, workingMetadata, this);
        
        form.append(
            general_section,
            publisher_section,
            source_section,
            keywords_section,
            page_types_section,
            content_types_section,
            samples_section,
            taxonomies_section,
            report_sections_section
        );

        form.addEventListener('submit', event => {
            event.preventDefault();
            handle_submit({
                form,
                originalMetadata: metadata,
                workingMetadata,
                Translation: this.Translation,
                Helpers: this.Helpers,
                NotificationComponent: this.NotificationComponent,
                getState: this.getState,
                dispatch: this.dispatch,
                StoreActionTypes: this.StoreActionTypes,
                router: this.router,
                report_template_ref: this._report_template_ref
            });
        });

        const footerActions = this.Helpers.create_element('div', { class_name: 'metadata-edit-form-footer-actions' });
        const footerSaveButton = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: `<span>${this.Translation.t('rulefile_metadata_save_metadata')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
        });
        footerSaveButton.addEventListener('click', () => form.requestSubmit());

        const footerCancelButton = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            html_content: `<span>${this.Translation.t('rulefile_metadata_view_without_saving')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('visibility') : '')
        });
        footerCancelButton.addEventListener('click', () => this.router('edit_rulefile_main'));

        footerActions.append(footerSaveButton, footerCancelButton);
        form.appendChild(footerActions);

        return { form, workingMetadata };
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();

        if (!state?.ruleFileContent?.metadata) {
            this.router('edit_rulefile_main');
            return;
        }

        const is_create_mode = this.params?.mode === 'create' || !state?.ruleSetId;

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: ['content-plate', 'rulefile-metadata-edit-plate'] });

        const headingWrapper = this.Helpers.create_element('div', { class_name: 'metadata-edit-header' });
        headingWrapper.appendChild(this.Helpers.create_element('h1', { text_content: t('rulefile_metadata_edit_title') }));
        const introParagraph = this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_metadata_edit_intro')
        });
        headingWrapper.appendChild(introParagraph);
        plate.appendChild(headingWrapper);

        const { form } = this._create_form(state.ruleFileContent.metadata, is_create_mode);

        const actionRow = this.Helpers.create_element('div', { class_name: 'metadata-edit-actions' });
        const saveTopButton = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            attributes: { type: 'button' },
            html_content: `<span>${t('rulefile_metadata_save_metadata')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
        });
        saveTopButton.addEventListener('click', () => form.requestSubmit());

        const backButton = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            attributes: { type: 'button' },
            html_content: `<span>${is_create_mode ? t('back_without_saving') : t('rulefile_metadata_view_without_saving')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg(is_create_mode ? 'arrow_back' : 'visibility') : '')
        });
        backButton.addEventListener('click', () => {
            if (is_create_mode) {
                this.router('audit_rules');
            } else {
                this.router('edit_rulefile_main');
            }
        });

        actionRow.append(saveTopButton, backButton);

        plate.appendChild(actionRow);
        plate.appendChild(form);

        this.root.appendChild(plate);
    }

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
    }
}
