/**
 * Redigerare för sidtyper, innehållstyper och taxonomier i regelfilsmetadata.
 * @module js/components/rulefile_metadata/rulefile_metadata_page_content_editors
 */

import {
    create_inline_input,
    create_small_button
} from './rulefile_metadata_list_controls.js';
import { render_taxonomies_editor } from '../rulefile_sections/rulefile_taxonomies_editor_ui.js';

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

export function renderTaxonomiesEditor(ctx, container, workingMetadata) {
    render_taxonomies_editor(ctx, container, workingMetadata);
}
