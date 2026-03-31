/**
 * Redigerare för stickprovskategorier och stickprovstyper i regelfilsmetadata.
 * @module js/components/rulefile_metadata/rulefile_metadata_sample_editors
 */

import {
    create_checkbox_input,
    create_inline_input,
    create_small_button
} from './rulefile_metadata_list_controls.js';

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
