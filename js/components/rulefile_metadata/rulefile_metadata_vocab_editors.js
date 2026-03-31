/**
 * Redigerare för sidtyper, innehållstyper, stickprov och taxonomier i regelfilsmetadata.
 * @module js/components/rulefile_metadata/rulefile_metadata_vocab_editors
 */

import {
    create_checkbox_input,
    create_inline_input,
    create_small_button
} from './rulefile_metadata_list_controls.js';

export function renderPageTypesEditor(ctx, container, workingMetadata) {
        container.innerHTML = '';
        const { Helpers, Translation } = ctx;

        if (!Array.isArray(workingMetadata.pageTypes) || workingMetadata.pageTypes.length === 0) {
            const emptyRow = Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: Translation.t('rulefile_metadata_empty_value')
            });
            container.appendChild(emptyRow);
        }

        workingMetadata.pageTypes.forEach((pageType, index) => {
            const row = Helpers.create_element('div', { class_name: 'editable-list-row' });
            const displayName = pageType || Translation.t('rulefile_metadata_untitled_item');
            const removeLabel = Translation.t('rulefile_metadata_remove_page_type', { name: displayName });
            const removeBtn = create_small_button(ctx, removeLabel, 'delete', () => {
                workingMetadata.pageTypes.splice(index, 1);
                renderPageTypesEditor(ctx, container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: removeLabel });

            const field = create_inline_input(ctx, 'rulefile_metadata_field_text', pageType, value => {
                workingMetadata.pageTypes[index] = value;
                const updatedName = value || Translation.t('rulefile_metadata_untitled_item');
                const updatedLabel = Translation.t('rulefile_metadata_remove_page_type', { name: updatedName });
                removeBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }, { rawLabel: Translation.t('rulefile_metadata_field_text') });
            row.append(field, removeBtn);
            container.appendChild(row);
        });

        const addBtn = create_small_button(ctx, 'rulefile_metadata_add_page_type', 'add', () => {
            workingMetadata.pageTypes.push('');
            renderPageTypesEditor(ctx, container, workingMetadata);
        });
        container.appendChild(addBtn);
    }

export function renderContentTypesEditor(ctx, container, workingMetadata) {
        container.innerHTML = '';
        const { Helpers, Translation } = ctx;

        if (!Array.isArray(workingMetadata.contentTypes) || workingMetadata.contentTypes.length === 0) {
            const emptyRow = Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: Translation.t('rulefile_metadata_empty_value')
            });
            container.appendChild(emptyRow);
        }

        workingMetadata.contentTypes.forEach((parent, parentIndex) => {
            if (!parent) {
                workingMetadata.contentTypes[parentIndex] = { id: '', text: '', description: '', types: [] };
                parent = workingMetadata.contentTypes[parentIndex];
            }
            parent.types = Array.isArray(parent.types) ? parent.types : [];

            const card = Helpers.create_element('article', { class_name: 'editable-card' });
            const headingRow = Helpers.create_element('div', { class_name: 'editable-card-header' });
            const heading = Helpers.create_element('h3', { text_content: parent.text || Translation.t('rulefile_metadata_untitled_item') });
            const initialRemoveLabel = Translation.t('rulefile_metadata_remove_content_type', { name: heading.textContent });
            const removeParentBtn = create_small_button(ctx, initialRemoveLabel, 'delete', () => {
                workingMetadata.contentTypes.splice(parentIndex, 1);
                renderContentTypesEditor(ctx, container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: initialRemoveLabel });
            headingRow.append(heading, removeParentBtn);
            card.appendChild(headingRow);

            card.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_text', parent.text || '', value => {
                parent.text = value;
                const displayName = value || Translation.t('rulefile_metadata_untitled_item');
                heading.textContent = displayName;
                const updatedLabel = Translation.t('rulefile_metadata_remove_content_type', { name: displayName });
                removeParentBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }));

            const childList = Helpers.create_element('div', { class_name: 'editable-sublist' });
            parent.types.forEach((child, childIndex) => {
                if (!child) {
                    parent.types[childIndex] = { id: '', text: '', description: '' };
                    child = parent.types[childIndex];
                }
                const childCard = Helpers.create_element('div', { class_name: 'editable-card editable-child-card' });
                const childDisplayName = child.text || Translation.t('rulefile_metadata_untitled_item');
                const removeChildInitial = Translation.t('rulefile_metadata_remove_content_subtype', { name: childDisplayName });
                const removeChildBtn = create_small_button(ctx, removeChildInitial, 'delete', () => {
                    parent.types.splice(childIndex, 1);
                    renderContentTypesEditor(ctx, container, workingMetadata);
                }, 'danger', { plainText: true, ariaLabel: removeChildInitial });
                childCard.appendChild(removeChildBtn);

                childCard.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_text', child.text || '', value => {
                    child.text = value;
                    const updatedName = value || Translation.t('rulefile_metadata_untitled_item');
                    const updatedLabel = Translation.t('rulefile_metadata_remove_content_subtype', { name: updatedName });
                    removeChildBtn.updateButtonText?.(updatedLabel, updatedLabel);
                }));
                childCard.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_description', child.description || '', value => {
                    child.description = value;
                }, { textarea: true }));
                childList.appendChild(childCard);
            });

            const addChildBtn = create_small_button(ctx, 'rulefile_metadata_add_content_subtype', 'add', () => {
                parent.types.push({ id: '', text: '', description: '' });
                renderContentTypesEditor(ctx, container, workingMetadata);
            });
            childList.appendChild(addChildBtn);
            card.appendChild(childList);
            container.appendChild(card);
        });

        const addParentBtn = create_small_button(ctx, 'rulefile_metadata_add_content_type', 'add', () => {
            workingMetadata.contentTypes.push({ id: '', text: '', description: '', types: [] });
            renderContentTypesEditor(ctx, container, workingMetadata);
        });
        container.appendChild(addParentBtn);
    }

export function renderSampleCategoriesEditor(ctx, container, workingMetadata) {
        container.innerHTML = '';
        const { Helpers, Translation } = ctx;
        // Support both old format (metadata.samples.sampleCategories) and new format (metadata.vocabularies.sampleTypes.sampleCategories)
        const categories = workingMetadata.vocabularies?.sampleTypes?.sampleCategories || workingMetadata.samples?.sampleCategories || [];
        if (categories.length === 0) {
            container.appendChild(Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: Translation.t('rulefile_metadata_empty_value')
            }));
        }

        categories.forEach((category, categoryIndex) => {
            if (!category) {
                categories[categoryIndex] = { id: '', text: '', hasUrl: false, categories: [] };
                category = categories[categoryIndex];
            }
            category.categories = Array.isArray(category.categories) ? category.categories : [];

            const card = Helpers.create_element('article', { class_name: 'editable-card' });
            const headingRow = Helpers.create_element('div', { class_name: 'editable-card-header' });
            const heading = Helpers.create_element('h3', { text_content: category.text || Translation.t('rulefile_metadata_untitled_item') });
            const removeCategoryInitial = Translation.t('rulefile_metadata_remove_sample_category', { name: heading.textContent });
            const removeCategoryBtn = create_small_button(ctx, removeCategoryInitial, 'delete', () => {
                categories.splice(categoryIndex, 1);
                // Ensure vocabularies structure is updated
                if (!workingMetadata.vocabularies) {
                    workingMetadata.vocabularies = {};
                }
                if (!workingMetadata.vocabularies.sampleTypes) {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                // Also update samples for backward compatibility
                if (!workingMetadata.samples) {
                    workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.samples.sampleCategories = categories;
                renderSampleCategoriesEditor(ctx, container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: removeCategoryInitial });
            headingRow.append(heading, removeCategoryBtn);
            card.appendChild(headingRow);

            card.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_text', category.text || '', value => {
                category.text = value;
                // Sync to vocabularies structure
                if (!workingMetadata.vocabularies) {
                    workingMetadata.vocabularies = {};
                }
                if (!workingMetadata.vocabularies.sampleTypes) {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                // Also update samples for backward compatibility
                if (!workingMetadata.samples) {
                    workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.samples.sampleCategories = categories;
                const updatedName = value || Translation.t('rulefile_metadata_untitled_item');
                const updatedLabel = Translation.t('rulefile_metadata_remove_sample_category', { name: updatedName });
                heading.textContent = updatedName;
                removeCategoryBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }));
            card.appendChild(create_checkbox_input(ctx, 'rulefile_metadata_field_has_url', category.hasUrl, value => {
                category.hasUrl = value;
                // Sync to vocabularies structure
                if (!workingMetadata.vocabularies) {
                    workingMetadata.vocabularies = {};
                }
                if (!workingMetadata.vocabularies.sampleTypes) {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                // Also update samples for backward compatibility
                if (!workingMetadata.samples) {
                    workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.samples.sampleCategories = categories;
            }));

            const subList = Helpers.create_element('div', { class_name: 'editable-sublist' });
            category.categories.forEach((subCategory, subIndex) => {
                if (!subCategory) {
                    category.categories[subIndex] = { id: '', text: '' };
                    subCategory = category.categories[subIndex];
                }
                const row = Helpers.create_element('div', { class_name: 'editable-list-row' });
                const subDisplay = subCategory.text || Translation.t('rulefile_metadata_untitled_item');
                const removeSubInitial = Translation.t('rulefile_metadata_remove_sample_subcategory', { name: subDisplay });
                const removeSubBtn = create_small_button(ctx, removeSubInitial, 'delete', () => {
                    category.categories.splice(subIndex, 1);
                    // Sync to vocabularies structure
                    if (!workingMetadata.vocabularies) {
                        workingMetadata.vocabularies = {};
                    }
                    if (!workingMetadata.vocabularies.sampleTypes) {
                        workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                    }
                    workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                    // Also update samples for backward compatibility
                    if (!workingMetadata.samples) {
                        workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                    }
                    workingMetadata.samples.sampleCategories = categories;
                    renderSampleCategoriesEditor(ctx, container, workingMetadata);
                }, 'danger', { plainText: true, ariaLabel: removeSubInitial });
                row.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_text', subCategory.text || '', value => {
                    subCategory.text = value;
                    // Sync to vocabularies structure
                    if (!workingMetadata.vocabularies) {
                        workingMetadata.vocabularies = {};
                    }
                    if (!workingMetadata.vocabularies.sampleTypes) {
                        workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                    }
                    workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                    // Also update samples for backward compatibility
                    if (!workingMetadata.samples) {
                        workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                    }
                    workingMetadata.samples.sampleCategories = categories;
                    const updatedName = value || Translation.t('rulefile_metadata_untitled_item');
                    const updatedLabel = Translation.t('rulefile_metadata_remove_sample_subcategory', { name: updatedName });
                    removeSubBtn.updateButtonText?.(updatedLabel, updatedLabel);
                }));
                row.appendChild(removeSubBtn);
                subList.appendChild(row);
            });

            const addSubBtn = create_small_button(ctx, 'rulefile_metadata_add_sample_subcategory', 'add', () => {
                category.categories.push({ id: '', text: '' });
                // Sync to vocabularies structure
                if (!workingMetadata.vocabularies) {
                    workingMetadata.vocabularies = {};
                }
                if (!workingMetadata.vocabularies.sampleTypes) {
                    workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
                // Also update samples for backward compatibility
                if (!workingMetadata.samples) {
                    workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
                }
                workingMetadata.samples.sampleCategories = categories;
                renderSampleCategoriesEditor(ctx, container, workingMetadata);
            });
            subList.appendChild(addSubBtn);
            card.appendChild(subList);
            container.appendChild(card);
        });

        const addCategoryBtn = create_small_button(ctx, 'rulefile_metadata_add_sample_category', 'add', () => {
            categories.push({ id: '', text: '', hasUrl: false, categories: [] });
            // Ensure vocabularies structure is updated
            if (!workingMetadata.vocabularies) {
                workingMetadata.vocabularies = {};
            }
            if (!workingMetadata.vocabularies.sampleTypes) {
                workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
            }
            workingMetadata.vocabularies.sampleTypes.sampleCategories = categories;
            // Also update samples for backward compatibility
            if (!workingMetadata.samples) {
                workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
            }
            workingMetadata.samples.sampleCategories = categories;
            renderSampleCategoriesEditor(ctx, container, workingMetadata);
        });
        container.appendChild(addCategoryBtn);
    }

export function renderSampleTypesEditor(ctx, container, workingMetadata) {
        container.innerHTML = '';
        const { Helpers, Translation } = ctx;
        const sampleTypes = workingMetadata.samples.sampleTypes || [];

        if (sampleTypes.length === 0) {
            container.appendChild(Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: Translation.t('rulefile_metadata_empty_value')
            }));
        }

        sampleTypes.forEach((type, index) => {
            const row = Helpers.create_element('div', { class_name: 'editable-list-row' });
            const displayName = type || Translation.t('rulefile_metadata_untitled_item');
            const removeLabel = Translation.t('rulefile_metadata_remove_sample_type', { name: displayName });
            const removeBtn = create_small_button(ctx, removeLabel, 'delete', () => {
                sampleTypes.splice(index, 1);
                renderSampleTypesEditor(ctx, container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: removeLabel });
            row.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_text', type || '', value => {
                sampleTypes[index] = value;
                const updatedName = value || Translation.t('rulefile_metadata_untitled_item');
                const updatedLabel = Translation.t('rulefile_metadata_remove_sample_type', { name: updatedName });
                removeBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }, { rawLabel: Translation.t('rulefile_metadata_field_text') }));
            row.appendChild(removeBtn);
            container.appendChild(row);
        });

        const addBtn = create_small_button(ctx, 'rulefile_metadata_add_sample_type', 'add', () => {
            sampleTypes.push('');
            renderSampleTypesEditor(ctx, container, workingMetadata);
        });
        container.appendChild(addBtn);
    }

export function renderTaxonomiesEditor(ctx, container, workingMetadata) {
        container.innerHTML = '';
        const { Helpers, Translation } = ctx;
        if (!Array.isArray(workingMetadata.taxonomies) || workingMetadata.taxonomies.length === 0) {
            container.appendChild(Helpers.create_element('p', {
                class_name: 'editable-empty',
                text_content: Translation.t('rulefile_metadata_empty_value')
            }));
        }

        workingMetadata.taxonomies.forEach((taxonomy, taxonomyIndex) => {
            if (!taxonomy) {
                workingMetadata.taxonomies[taxonomyIndex] = { id: '', label: '', version: '', uri: '', concepts: [] };
                taxonomy = workingMetadata.taxonomies[taxonomyIndex];
            }
            taxonomy.concepts = Array.isArray(taxonomy.concepts) ? taxonomy.concepts : [];

            const card = Helpers.create_element('article', { class_name: 'editable-card' });
            const headingRow = Helpers.create_element('div', { class_name: 'editable-card-header' });
            const heading = Helpers.create_element('h3', { text_content: taxonomy.label || Translation.t('rulefile_metadata_untitled_item') });
            const removeTaxonomyInitial = Translation.t('rulefile_metadata_remove_taxonomy', { name: heading.textContent });
            const removeTaxonomyBtn = create_small_button(ctx, removeTaxonomyInitial, 'delete', () => {
                workingMetadata.taxonomies.splice(taxonomyIndex, 1);
                renderTaxonomiesEditor(ctx, container, workingMetadata);
            }, 'danger', { plainText: true, ariaLabel: removeTaxonomyInitial });
            headingRow.append(heading, removeTaxonomyBtn);
            card.appendChild(headingRow);

            card.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_label', taxonomy.label || '', value => {
                taxonomy.label = value;
                const updatedName = value || Translation.t('rulefile_metadata_untitled_item');
                heading.textContent = updatedName;
                const updatedLabel = Translation.t('rulefile_metadata_remove_taxonomy', { name: updatedName });
                removeTaxonomyBtn.updateButtonText?.(updatedLabel, updatedLabel);
            }));
            card.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_taxonomy_version', taxonomy.version || '', value => {
                taxonomy.version = value;
            }));
            card.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_taxonomy_uri', taxonomy.uri || '', value => {
                taxonomy.uri = value;
            }));

            const conceptList = Helpers.create_element('div', { class_name: 'editable-sublist' });
            taxonomy.concepts.forEach((concept, conceptIndex) => {
                if (!concept) {
                    taxonomy.concepts[conceptIndex] = { id: '', label: '' };
                    concept = taxonomy.concepts[conceptIndex];
                }
                const row = Helpers.create_element('div', { class_name: 'editable-list-row' });
                const conceptName = concept.label || Translation.t('rulefile_metadata_untitled_item');
                const removeConceptInitial = Translation.t('rulefile_metadata_remove_taxonomy_concept', { name: conceptName });
                const removeConceptBtn = create_small_button(ctx, removeConceptInitial, 'delete', () => {
                    taxonomy.concepts.splice(conceptIndex, 1);
                    renderTaxonomiesEditor(ctx, container, workingMetadata);
                }, 'danger', { plainText: true, ariaLabel: removeConceptInitial });
                row.appendChild(create_inline_input(ctx, 'rulefile_metadata_field_label', concept.label || '', value => {
                    concept.label = value;
                    const updatedName = value || Translation.t('rulefile_metadata_untitled_item');
                    const updatedLabel = Translation.t('rulefile_metadata_remove_taxonomy_concept', { name: updatedName });
                    removeConceptBtn.updateButtonText?.(updatedLabel, updatedLabel);
                }));
                row.appendChild(removeConceptBtn);
                conceptList.appendChild(row);
            });

            const addConceptBtn = create_small_button(ctx, 'rulefile_metadata_add_taxonomy_concept', 'add', () => {
                taxonomy.concepts.push({ id: '', label: '' });
                renderTaxonomiesEditor(ctx, container, workingMetadata);
            });
            conceptList.appendChild(addConceptBtn);

            card.appendChild(conceptList);
            container.appendChild(card);
        });

        const addTaxonomyBtn = create_small_button(ctx, 'rulefile_metadata_add_taxonomy', 'add', () => {
            workingMetadata.taxonomies.push({ id: '', label: '', version: '', uri: '', concepts: [] });
            renderTaxonomiesEditor(ctx, container, workingMetadata);
        });
        container.appendChild(addTaxonomyBtn);
    }

