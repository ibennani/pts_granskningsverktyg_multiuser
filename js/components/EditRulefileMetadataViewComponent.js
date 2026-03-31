// js/components/EditRulefileMetadataViewComponent.js
import { create_production_rule } from '../api/client.js';
import { clone_metadata, ensure_metadata_defaults } from '../logic/rulefile_metadata_model.js';
import { generate_slug, ensure_unique_slug } from '../logic/rulefile_metadata_slug.js';
import { create_field, create_language_select_field } from './rulefile_metadata/rulefile_metadata_form_fields.js';
import {
    collect_missing_required_metadata_fields,
    show_rulefile_required_fields_modal
} from './rulefile_metadata/rulefile_metadata_validation.js';
import {
    renderContentTypesEditor,
    renderPageTypesEditor,
    renderSampleCategoriesEditor,
    renderSampleTypesEditor,
    renderTaxonomiesEditor
} from './rulefile_metadata/rulefile_metadata_vocab_editors.js';
import './edit_rulefile_metadata_view.css';
import { create_report_template_section } from './rulefile_metadata/rulefile_metadata_report_template.js';

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
                this._handle_submit_create(form);
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
            this._handle_submit(form, metadata, workingMetadata);
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

    async _handle_submit_create(form) {
        const t = this.Translation.t;
        const formData = new FormData(form);
        const getValue = name => (formData.get(name) || '').toString().trim();

        const missingFields = collect_missing_required_metadata_fields(formData);
        if (missingFields.length > 0) {
            const firstName = missingFields[0]?.name || null;
            show_rulefile_required_fields_modal(
                { Helpers: this.Helpers, Translation: this.Translation, NotificationComponent: this.NotificationComponent },
                missingFields,
                form,
                firstName
            );
            return;
        }

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const date_str = `${yyyy}-${mm}-${dd}`;

        const rule_set_id = this.getState()?.ruleFileContent?.metadata?.ruleSetId
            || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null)
            || (this.Helpers?.generate_uuid_v4 ? this.Helpers.generate_uuid_v4() : null);
        const uuid = rule_set_id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        const content = {
            metadata: {
                title: getValue('metadata.title'),
                description: getValue('metadata.description'),
                language: getValue('metadata.language'),
                monitoringType: { text: getValue('metadata.monitoringType.text') },
                publisher: {
                    name: getValue('metadata.publisher.name'),
                    contactPoint: getValue('metadata.publisher.contactPoint')
                },
                source: {
                    url: getValue('metadata.source.url'),
                    title: getValue('metadata.source.title')
                },
                dateCreated: date_str,
                dateModified: date_str,
                ruleSetId: uuid
            },
            requirements: {}
        };

        try {
            const created = await create_production_rule({ content });
            const stored_content = created?.content || content;
            if (stored_content?.metadata) {
                stored_content.metadata.ruleSetId = created?.id || stored_content.metadata.ruleSetId;
            }
            this.dispatch({
                type: this.StoreActionTypes.INITIALIZE_RULEFILE_EDITING,
                payload: {
                    ruleFileContent: stored_content,
                    originalRuleFileContentString: JSON.stringify(stored_content, null, 2),
                    originalRuleFileFilename: stored_content?.metadata?.title || '',
                    ruleSetId: created?.id,
                    ruleFileServerVersion: created?.version ?? 0,
                    ruleFileIsPublished: false
                }
            });
            this.NotificationComponent.show_global_message?.(t('rulefile_metadata_edit_saved'), 'success');
            this.router('rulefile_metadata_view');
        } catch (err) {
            this.NotificationComponent.show_global_message?.(
                err?.message || t('rulefile_metadata_edit_save_error'),
                'error'
            );
        }
    }

    _handle_submit(form, originalMetadata, workingMetadata) {
        const t = this.Translation.t;
        const formData = new FormData(form);
        const getValue = name => (formData.get(name) || '').toString().trim();

        const missingFields = collect_missing_required_metadata_fields(formData);
        if (missingFields.length > 0) {
            const firstName = missingFields[0]?.name || null;
            show_rulefile_required_fields_modal(
                { Helpers: this.Helpers, Translation: this.Translation, NotificationComponent: this.NotificationComponent },
                missingFields,
                form,
                firstName
            );
            return;
        }

        const keywords_input = getValue('metadata.keywords');
        const keywords = keywords_input
            ? keywords_input.split(/[\n\r,]+/).map(entry => entry.trim()).filter(Boolean)
            : [];

        const cleanedPageTypes = (workingMetadata.pageTypes || [])
            .map(entry => (entry || '').trim())
            .filter(Boolean);

        const cleanedContentTypes = (workingMetadata.contentTypes || []).map(parent => {
            const cleanedParent = {
                id: (parent.id || '').trim(),
                text: (parent.text || '').trim(),
                description: ''
            };
            const childTypes = Array.isArray(parent.types) ? parent.types : [];
            cleanedParent.types = childTypes
                .map(child => ({
                    id: (child?.id || '').trim(),
                    text: (child?.text || '').trim(),
                    description: (child?.description || '').trim()
                }))
                .filter(child => child.id || child.text || child.description);
            return cleanedParent;
        }).filter(parent => parent.id || parent.text || (parent.types && parent.types.length > 0));

        const cleanedSampleCategories = (workingMetadata.samples?.sampleCategories || []).map(category => {
            const cleanedCategory = {
                id: (category?.id || '').trim(),
                text: (category?.text || '').trim(),
                hasUrl: !!category?.hasUrl
            };
            const subCategories = Array.isArray(category?.categories) ? category.categories : [];
            cleanedCategory.categories = subCategories
                .map(sub => ({
                    id: (sub?.id || '').trim(),
                    text: (sub?.text || '').trim()
                }))
                .filter(sub => sub.id || sub.text);
            return cleanedCategory;
        }).filter(cat => cat.id || cat.text || (cat.categories && cat.categories.length > 0));

        const cleanedSampleTypes = (workingMetadata.samples?.sampleTypes || [])
            .map(entry => (entry || '').trim())
            .filter(Boolean);

        const cleanedTaxonomies = (workingMetadata.taxonomies || []).map(taxonomy => {
            const cleanedTaxonomy = {
                id: (taxonomy?.id || '').trim(),
                label: (taxonomy?.label || '').trim(),
                version: (taxonomy?.version || '').trim(),
                uri: (taxonomy?.uri || '').trim()
            };
            const concepts = Array.isArray(taxonomy?.concepts) ? taxonomy.concepts : [];
            cleanedTaxonomy.concepts = concepts
                .map(concept => ({
                    id: (concept?.id || '').trim(),
                    label: (concept?.label || '').trim()
                }))
                .filter(concept => concept.id || concept.label);
            return cleanedTaxonomy;
        }).filter(taxonomy => taxonomy.id || taxonomy.label || taxonomy.version || taxonomy.uri || (taxonomy.concepts && taxonomy.concepts.length > 0));

        const contentTypeSlugSet = new Set(cleanedContentTypes.map(ct => ct.id).filter(Boolean));
        cleanedContentTypes.forEach(parent => {
            if (!parent.id) {
                parent.id = ensure_unique_slug(contentTypeSlugSet, generate_slug(parent.text), 'content-type');
            } else {
                contentTypeSlugSet.add(parent.id);
            }

            const childSlugSet = new Set(parent.types.map(child => child.id).filter(Boolean));
            parent.types.forEach(child => {
                if (!child.id) {
                    const childSlug = generate_slug(child.text);
                    const base = parent.id || generate_slug(parent.text) || 'content';
                    const preferred = childSlug ? `${base}-${childSlug}` : '';
                    child.id = ensure_unique_slug(childSlugSet, preferred, `${base}-child`);
                } else {
                    childSlugSet.add(child.id);
                }
            });
        });

        const sampleCategorySlugSet = new Set(cleanedSampleCategories.map(cat => cat.id).filter(Boolean));
        cleanedSampleCategories.forEach(category => {
            if (!category.id) {
                category.id = ensure_unique_slug(sampleCategorySlugSet, generate_slug(category.text), 'sample-category');
            } else {
                sampleCategorySlugSet.add(category.id);
            }

            const subSlugSet = new Set(category.categories.map(sub => sub.id).filter(Boolean));
            category.categories.forEach(sub => {
                if (!sub.id) {
                    const subSlug = generate_slug(sub.text);
                    const base = category.id || 'category';
                    const preferred = subSlug ? `${base}-${subSlug}` : '';
                    sub.id = ensure_unique_slug(subSlugSet, preferred, `${base}-subcategory`);
                } else {
                    subSlugSet.add(sub.id);
                }
            });
        });

        const taxonomySlugSet = new Set(cleanedTaxonomies.map(t => t.id).filter(Boolean));
        cleanedTaxonomies.forEach(taxonomy => {
            if (!taxonomy.id) {
                taxonomy.id = ensure_unique_slug(taxonomySlugSet, generate_slug(taxonomy.label), 'taxonomy');
            } else {
                taxonomySlugSet.add(taxonomy.id);
            }

            const conceptSlugSet = new Set(taxonomy.concepts.map(c => c.id).filter(Boolean));
            taxonomy.concepts.forEach(concept => {
                if (!concept.id) {
                    const conceptSlug = generate_slug(concept.label);
                    const base = taxonomy.id || 'taxonomy';
                    const preferred = conceptSlug ? `${base}-${conceptSlug}` : '';
                    concept.id = ensure_unique_slug(conceptSlugSet, preferred, `${base}-concept`);
                } else {
                    conceptSlugSet.add(concept.id);
                }
            });
        });

        const updatedMetadata = {
            ...originalMetadata,
            title: getValue('metadata.title'),
            description: formData.get('metadata.description')?.toString() || '',
            version: getValue('metadata.version'),
            language: getValue('metadata.language'),
            monitoringType: {
                ...originalMetadata.monitoringType,
                type: getValue('metadata.monitoringType.type'),
                text: getValue('metadata.monitoringType.text')
            },
            dateCreated: getValue('metadata.dateCreated'),
            dateModified: getValue('metadata.dateModified'),
            license: getValue('metadata.license'),
            publisher: {
                ...originalMetadata.publisher,
                name: getValue('metadata.publisher.name'),
                contactPoint: getValue('metadata.publisher.contactPoint')
            },
            source: {
                ...originalMetadata.source,
                url: getValue('metadata.source.url'),
                title: getValue('metadata.source.title'),
                retrievedDate: getValue('metadata.source.retrievedDate'),
                format: getValue('metadata.source.format')
            },
            keywords,
            pageTypes: cleanedPageTypes,
            contentTypes: cleanedContentTypes,
            samples: {
                ...originalMetadata.samples,
                sampleCategories: cleanedSampleCategories,
                sampleTypes: cleanedSampleTypes
            },
            taxonomies: cleanedTaxonomies,
            // Update vocabularies structure
            vocabularies: {
                ...originalMetadata.vocabularies,
                pageTypes: cleanedPageTypes,
                contentTypes: cleanedContentTypes,
                taxonomies: cleanedTaxonomies,
                sampleTypes: {
                    sampleCategories: cleanedSampleCategories,
                    sampleTypes: cleanedSampleTypes
                }
            }
        };

        // Collect report template sections data
        const report_template_sections = {};
        const report_section_order = [];
        if (this._report_template_ref) {
            const section_cards = form.querySelectorAll('.report-section-card');
            section_cards.forEach(card => {
                const section_id = card.dataset.sectionId;
                if (!section_id) return;
                
                const name_input = card.querySelector(`input[data-field="name"][data-section-id="${section_id}"]`);
                const required_checkbox = card.querySelector(`input[data-field="required"][data-section-id="${section_id}"]`);
                const content_textarea = card.querySelector(`textarea[data-field="content"][data-section-id="${section_id}"]`);
                // Obligatoriska sektioner har ingen checkbox – använd befintlig sektionsdata
                const required = required_checkbox
                    ? required_checkbox.checked
                    : (this._report_template_ref?.sections?.[section_id]?.required ?? false);

                const content_raw = content_textarea?.value || '';
                const content_trimmed = this.Helpers?.trim_textarea_preserve_lines
                    ? this.Helpers.trim_textarea_preserve_lines(content_raw)
                    : content_raw.trim();
                report_template_sections[section_id] = {
                    name: name_input?.value.trim() || '',
                    required,
                    content: content_trimmed
                };
                report_section_order.push(section_id);
            });
        }
        
        // Update metadata.blockOrders.reportSections
        if (report_section_order.length > 0) {
            if (!updatedMetadata.blockOrders) {
                updatedMetadata.blockOrders = {};
            }
            updatedMetadata.blockOrders.reportSections = report_section_order;
        }
        
        const state = this.getState();
        const currentRulefile = state?.ruleFileContent || {};
        const updatedRulefileContent = {
            ...currentRulefile,
            metadata: updatedMetadata
        };
        
        // Update reportTemplate if it exists or create it
        if (Object.keys(report_template_sections).length > 0 || currentRulefile.reportTemplate) {
            updatedRulefileContent.reportTemplate = {
                sections: report_template_sections
            };
        }

        this.dispatch({
            type: this.StoreActionTypes.UPDATE_RULEFILE_CONTENT,
            payload: { ruleFileContent: updatedRulefileContent }
        });

        this.NotificationComponent.show_global_message?.(t('rulefile_metadata_edit_saved'), 'success');
        this.router('edit_rulefile_main');
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
