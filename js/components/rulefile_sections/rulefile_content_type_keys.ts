/**
 * @fileoverview Hjälpfunktioner för innehållstyp-routing och uppslag i metadata.
 */
import { resolve_content_types } from '../../../shared/rulefile/rulefile_metadata_vocabularies.js';

export const CONTENT_TYPE_NEW_PARAM = 'new';

export type ContentTypeChild = {
    id?: string;
    text?: string;
    description?: string;
    detectionPattern?: string;
};

export type ContentTypeParent = {
    id?: string;
    text?: string;
    description?: string;
    types?: ContentTypeChild[];
};

export type ContentTypeLocation = {
    parent_index: number;
    child_index: number;
    parent: ContentTypeParent;
    child: ContentTypeChild;
};

export function read_content_type_parents(metadata: Record<string, unknown>): ContentTypeParent[] {
    return resolve_content_types(metadata) as ContentTypeParent[];
}

export function is_content_type_create_param(content_type_id: string): boolean {
    return content_type_id === CONTENT_TYPE_NEW_PARAM;
}

export function resolve_content_type_edit_mode(content_type_id: string): 'overview' | 'create' | 'edit' {
    const trimmed = content_type_id.trim();
    if (!trimmed) return 'overview';
    if (is_content_type_create_param(trimmed)) return 'create';
    return 'edit';
}

export function find_content_type_by_child_id(
    metadata: Record<string, unknown>,
    child_id: string
): ContentTypeLocation | null {
    const normalized = child_id.trim().toLowerCase();
    if (!normalized) return null;
    const parents = read_content_type_parents(metadata);
    for (let parent_index = 0; parent_index < parents.length; parent_index += 1) {
        const parent = parents[parent_index];
        const children = Array.isArray(parent.types) ? parent.types : [];
        for (let child_index = 0; child_index < children.length; child_index += 1) {
            const child = children[child_index];
            const id = String(child?.id ?? '').trim().toLowerCase();
            if (id && id === normalized) {
                return { parent_index, child_index, parent, child };
            }
        }
    }
    return null;
}

export function find_draft_content_type_for_create(
    metadata: Record<string, unknown>
): ContentTypeLocation | null {
    const parents = read_content_type_parents(metadata);
    for (let parent_index = parents.length - 1; parent_index >= 0; parent_index -= 1) {
        const parent = parents[parent_index];
        const children = Array.isArray(parent.types) ? parent.types : [];
        for (let child_index = children.length - 1; child_index >= 0; child_index -= 1) {
            const child = children[child_index];
            if (!String(child?.id ?? '').trim()) {
                return { parent_index, child_index, parent, child };
            }
        }
    }
    return null;
}

export function ensure_draft_content_type_for_create(
    metadata: Record<string, unknown>
): ContentTypeLocation {
    const existing = find_draft_content_type_for_create(metadata);
    if (existing) return existing;

    let parents = read_content_type_parents(metadata);
    if (parents.length === 0) {
        parents = [{ id: '', text: '', description: '', types: [] }];
        metadata.contentTypes = parents;
    }
    const parent_index = 0;
    const parent = parents[parent_index];
    parent.types = Array.isArray(parent.types) ? parent.types : [];
    const child: ContentTypeChild = {
        id: '',
        text: '',
        description: '',
        detectionPattern: '',
    };
    parent.types.push(child);
    metadata.contentTypes = parents;
    return {
        parent_index,
        child_index: parent.types.length - 1,
        parent,
        child,
    };
}

export function move_content_type_child_to_parent(
    metadata: Record<string, unknown>,
    location: ContentTypeLocation,
    target_parent_id: string
): ContentTypeLocation {
    const parents = read_content_type_parents(metadata);
    const source_parent = parents[location.parent_index];
    if (!source_parent?.types) return location;

    const normalized_target = target_parent_id.trim().toLowerCase();
    const target_parent_index = parents.findIndex((parent) => {
        const id = String(parent.id ?? '').trim().toLowerCase();
        return id && id === normalized_target;
    });
    if (target_parent_index < 0 || target_parent_index === location.parent_index) {
        return location;
    }

    const [moved_child] = source_parent.types.splice(location.child_index, 1);
    if (!moved_child) return location;

    const target_parent = parents[target_parent_index];
    target_parent.types = Array.isArray(target_parent.types) ? target_parent.types : [];
    target_parent.types.push(moved_child);
    metadata.contentTypes = parents;

    return {
        parent_index: target_parent_index,
        child_index: target_parent.types.length - 1,
        parent: target_parent,
        child: moved_child,
    };
}

export function content_type_list_route_params(): Record<string, string> {
    return { section: 'content_types', edit: 'true' };
}

export function content_type_create_route_params(): Record<string, string> {
    return { section: 'content_types', edit: 'true', contentTypeId: CONTENT_TYPE_NEW_PARAM };
}

export function content_type_edit_route_params(content_type_id: string): Record<string, string> {
    return { section: 'content_types', edit: 'true', contentTypeId: content_type_id };
}
