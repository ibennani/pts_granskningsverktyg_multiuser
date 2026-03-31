/**
 * Sparlogik för regelfilsmetadata (skapa ny regel / uppdatera befintlig).
 * @module js/logic/rulefile_metadata_submit
 */

import { create_production_rule } from '../api/client.js';
import {
    collect_missing_required_metadata_fields,
    show_rulefile_required_fields_modal
} from '../components/rulefile_metadata/rulefile_metadata_validation.js';
import { generate_slug, ensure_unique_slug } from './rulefile_metadata_slug.js';

/**
 * @param {object} deps
 * @param {HTMLFormElement} deps.form
 * @param {object} deps.Translation
 * @param {object} deps.Helpers
 * @param {object} deps.NotificationComponent
 * @param {function} deps.getState
 * @param {function} deps.dispatch
 * @param {object} deps.StoreActionTypes
 * @param {function} deps.router
 */
export async function handle_submit_create(deps) {
    const {
        form,
        Translation,
        Helpers,
        NotificationComponent,
        getState,
        dispatch,
        StoreActionTypes,
        router
    } = deps;
    const t = Translation.t;
    const formData = new FormData(form);
    const getValue = name => (formData.get(name) || '').toString().trim();

    const missingFields = collect_missing_required_metadata_fields(formData);
    if (missingFields.length > 0) {
        const firstName = missingFields[0]?.name || null;
        show_rulefile_required_fields_modal(
            { Helpers, Translation, NotificationComponent },
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

    const rule_set_id = getState()?.ruleFileContent?.metadata?.ruleSetId
        || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null)
        || (Helpers?.generate_uuid_v4 ? Helpers.generate_uuid_v4() : null);
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
        dispatch({
            type: StoreActionTypes.INITIALIZE_RULEFILE_EDITING,
            payload: {
                ruleFileContent: stored_content,
                originalRuleFileContentString: JSON.stringify(stored_content, null, 2),
                originalRuleFileFilename: stored_content?.metadata?.title || '',
                ruleSetId: created?.id,
                ruleFileServerVersion: created?.version ?? 0,
                ruleFileIsPublished: false
            }
        });
        NotificationComponent.show_global_message?.(t('rulefile_metadata_edit_saved'), 'success');
        router('rulefile_metadata_view');
    } catch (err) {
        NotificationComponent.show_global_message?.(
            err?.message || t('rulefile_metadata_edit_save_error'),
            'error'
        );
    }
}

/**
 * @param {object} deps
 * @param {HTMLFormElement} deps.form
 * @param {object} deps.originalMetadata
 * @param {object} deps.workingMetadata
 * @param {object} deps.Translation
 * @param {object} deps.Helpers
 * @param {object} deps.NotificationComponent
 * @param {function} deps.getState
 * @param {function} deps.dispatch
 * @param {object} deps.StoreActionTypes
 * @param {function} deps.router
 * @param {object|null|undefined} deps.report_template_ref
 */
export function handle_submit(deps) {
    const {
        form,
        originalMetadata,
        workingMetadata,
        Translation,
        Helpers,
        NotificationComponent,
        getState,
        dispatch,
        StoreActionTypes,
        router,
        report_template_ref
    } = deps;
    const t = Translation.t;
    const formData = new FormData(form);
    const getValue = name => (formData.get(name) || '').toString().trim();

    const missingFields = collect_missing_required_metadata_fields(formData);
    if (missingFields.length > 0) {
        const firstName = missingFields[0]?.name || null;
        show_rulefile_required_fields_modal(
            { Helpers, Translation, NotificationComponent },
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
    if (report_template_ref) {
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
                : (report_template_ref?.sections?.[section_id]?.required ?? false);

            const content_raw = content_textarea?.value || '';
            const content_trimmed = Helpers?.trim_textarea_preserve_lines
                ? Helpers.trim_textarea_preserve_lines(content_raw)
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

    const state = getState();
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

    dispatch({
        type: StoreActionTypes.UPDATE_RULEFILE_CONTENT,
        payload: { ruleFileContent: updatedRulefileContent }
    });

    NotificationComponent.show_global_message?.(t('rulefile_metadata_edit_saved'), 'success');
    router('edit_rulefile_main');
}
