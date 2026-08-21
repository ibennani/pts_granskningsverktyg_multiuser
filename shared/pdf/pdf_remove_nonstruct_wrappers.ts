/**
 * @fileoverview Tar bort NonStruct-wrappers i PDF-taggträdet och lyfter upp barn till föräldern.
 */
import {
    pdf_buffer_contains_marker,
    read_object_dictionary_at,
    replace_object_body_incrementally,
} from './pdf_incremental_object_replace.js';
import {
    parse_struct_elem_dict,
    replace_ref_in_k_entries,
    serialize_struct_elem_dict,
    type StructElemNode,
} from './pdf_struct_elem.js';

function load_struct_elem_nodes(buffer: Buffer): Map<number, StructElemNode> {
    const nodes = new Map<number, StructElemNode>();
    for (const object_number of discover_struct_elem_object_numbers(buffer)) {
        const dict = read_object_dictionary_at(buffer, object_number);
        const parsed = parse_struct_elem_dict(object_number, dict);
        if (parsed) {
            nodes.set(object_number, parsed);
        }
    }
    return nodes;
}

function discover_struct_elem_object_numbers(buffer: Buffer): number[] {
    const text = buffer.toString('latin1');
    const numbers: number[] = [];
    const object_pattern = /(\d+) 0 obj\r?\n<</g;
    for (const match of text.matchAll(object_pattern)) {
        const object_number = Number.parseInt(match[1], 10);
        try {
            const dict = read_object_dictionary_at(buffer, object_number);
            if (dict.includes('/Type /StructElem')) {
                numbers.push(object_number);
            }
        } catch {
            /* ignorera objekt utan dictionary */
        }
    }
    return numbers;
}

function find_catalog_object_number(buffer: Buffer): number {
    const tail = buffer.subarray(Math.max(0, buffer.length - 4096)).toString('latin1');
    const trailer_index = tail.lastIndexOf('trailer');
    const root_match = tail.slice(trailer_index).match(/\/Root\s+(\d+)\s+\d+\s+R/);
    if (!root_match) {
        throw new Error('PDF saknar Root');
    }
    return Number.parseInt(root_match[1], 10);
}

function find_document_struct_number(buffer: Buffer): number | null {
    const catalog_dict = read_object_dictionary_at(buffer, find_catalog_object_number(buffer));
    const struct_root_number = catalog_dict.match(/\/StructTreeRoot\s+(\d+)\s+\d+\s+R/)?.[1];
    if (!struct_root_number) {
        return null;
    }
    const struct_root_dict = read_object_dictionary_at(buffer, Number.parseInt(struct_root_number, 10));
    const document_ref = struct_root_dict.match(/\/K\s+(\d+)\s+\d+\s+R/)?.[1];
    return document_ref ? Number.parseInt(document_ref, 10) : null;
}

function collect_reachable_struct_types(
    buffer: Buffer,
    nodes: Map<number, StructElemNode>,
    start_number: number
): Set<string> {
    const visited = new Set<number>();
    const types = new Set<string>();
    const queue = [start_number];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined || visited.has(current)) {
            continue;
        }
        visited.add(current);
        const node = nodes.get(current);
        if (!node) {
            continue;
        }
        types.add(node.struct_type);
        for (const entry of node.k_entries) {
            if (entry.kind === 'ref') {
                queue.push(entry.object_number);
            }
        }
    }
    return types;
}

function has_reachable_nonstruct(buffer: Buffer, nodes: Map<number, StructElemNode>): boolean {
    const document_number = find_document_struct_number(buffer);
    if (document_number === null) {
        return false;
    }
    const types = collect_reachable_struct_types(buffer, nodes, document_number);
    return types.has('NonStruct');
}

function compute_struct_depth(node_number: number, nodes: Map<number, StructElemNode>, memo: Map<number, number>): number {
    const cached = memo.get(node_number);
    if (cached !== undefined) {
        return cached;
    }
    const node = nodes.get(node_number);
    if (!node || node.parent_number === null || !nodes.has(node.parent_number)) {
        memo.set(node_number, 0);
        return 0;
    }
    const depth = 1 + compute_struct_depth(node.parent_number, nodes, memo);
    memo.set(node_number, depth);
    return depth;
}

function unwrap_one_nonstruct(nodes: Map<number, StructElemNode>): boolean {
    const memo = new Map<number, number>();
    const nonstruct_nodes = [...nodes.values()]
        .filter((node) => node.struct_type === 'NonStruct')
        .sort(
            (left, right) =>
                compute_struct_depth(right.object_number, nodes, memo) -
                compute_struct_depth(left.object_number, nodes, memo)
        );

    for (const nonstruct of nonstruct_nodes) {
        if (!nodes.has(nonstruct.object_number)) {
            continue;
        }
        if (nonstruct.parent_number === null || !nodes.has(nonstruct.parent_number)) {
            continue;
        }
        const parent = nodes.get(nonstruct.parent_number);
        if (!parent) {
            continue;
        }

        parent.k_entries = replace_ref_in_k_entries(
            parent.k_entries,
            nonstruct.object_number,
            nonstruct.k_entries
        );
        for (const entry of nonstruct.k_entries) {
            if (entry.kind !== 'ref') {
                continue;
            }
            const child = nodes.get(entry.object_number);
            if (!child) {
                continue;
            }
            child.parent_number = parent.object_number;
        }
        if (nonstruct.page_number !== null && parent.page_number === null) {
            const only_mcid =
                nonstruct.k_entries.length > 0 &&
                nonstruct.k_entries.every((entry) => entry.kind === 'mcid' || entry.kind === 'inline');
            if (only_mcid) {
                parent.page_number = nonstruct.page_number;
            }
        }
        nodes.delete(nonstruct.object_number);
        return true;
    }
    return false;
}

function collect_updated_object_bodies(nodes: Map<number, StructElemNode>): Map<number, string> {
    const bodies = new Map<number, string>();
    for (const node of nodes.values()) {
        bodies.set(node.object_number, serialize_struct_elem_dict(node));
    }
    return bodies;
}

/**
 * Tar bort alla NonStruct-taggar genom att lyfta barnen ett steg i taggträdet.
 */
export function remove_nonstruct_wrappers_from_pdf(pdf_buffer: Buffer): Buffer {
    if (!pdf_buffer_contains_marker(pdf_buffer, 'StructTreeRoot')) {
        return pdf_buffer;
    }

    let nodes = load_struct_elem_nodes(pdf_buffer);
    if ([...nodes.values()].every((node) => node.struct_type !== 'NonStruct')) {
        return pdf_buffer;
    }

    let guard = 0;
    while (unwrap_one_nonstruct(nodes) && guard < 512) {
        guard += 1;
    }

    let updated = pdf_buffer;
    for (const [object_number, dict_body] of collect_updated_object_bodies(nodes)) {
        updated = replace_object_body_incrementally(updated, object_number, dict_body);
    }

    const updated_nodes = load_struct_elem_nodes(updated);
    if (has_reachable_nonstruct(updated, updated_nodes)) {
        throw new Error('PDF-efterbearbetning kunde inte ta bort alla NonStruct-taggar');
    }

    return updated;
}

export function count_reachable_nonstruct_nodes(buffer: Buffer): number {
    const nodes = load_struct_elem_nodes(buffer);
    const document_number = find_document_struct_number(buffer);
    if (document_number === null) {
        return 0;
    }
    let count = 0;
    const visited = new Set<number>();
    const queue = [document_number];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined || visited.has(current)) {
            continue;
        }
        visited.add(current);
        const node = nodes.get(current);
        if (!node) {
            continue;
        }
        if (node.struct_type === 'NonStruct') {
            count += 1;
        }
        for (const entry of node.k_entries) {
            if (entry.kind === 'ref') {
                queue.push(entry.object_number);
            }
        }
    }
    return count;
}

export function count_nonstruct_markers(buffer: Buffer): number {
    return count_reachable_nonstruct_nodes(buffer);
}
