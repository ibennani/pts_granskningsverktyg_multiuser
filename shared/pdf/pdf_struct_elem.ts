/**
 * @fileoverview Parsar och serialiserar PDF StructElem-objekt för taggträd-efterbearbetning.
 */

export type StructKEntry =
    | { kind: 'ref'; object_number: number }
    | { kind: 'mcid'; value: number }
    | { kind: 'inline'; raw: string };

export interface StructElemNode {
    object_number: number;
    struct_type: string;
    parent_number: number | null;
    page_number: number | null;
    k_entries: StructKEntry[];
    attributes_raw: string | null;
}

function parse_object_ref(dict: string, key: string): number | null {
    const match = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
    return match ? Number.parseInt(match[1], 10) : null;
}

function parse_k_array_content(array_content: string): StructKEntry[] {
    const entries: StructKEntry[] = [];
    let index = 0;
    while (index < array_content.length) {
        while (index < array_content.length && /\s/.test(array_content[index])) {
            index += 1;
        }
        if (index >= array_content.length) {
            break;
        }
        if (array_content[index] === '<' && array_content[index + 1] === '<') {
            let depth = 0;
            const start = index;
            while (index < array_content.length - 1) {
                if (array_content[index] === '<' && array_content[index + 1] === '<') {
                    depth += 1;
                    index += 2;
                    continue;
                }
                if (array_content[index] === '>' && array_content[index + 1] === '>') {
                    depth -= 1;
                    index += 2;
                    if (depth === 0) {
                        break;
                    }
                    continue;
                }
                index += 1;
            }
            entries.push({ kind: 'inline', raw: array_content.slice(start, index) });
            continue;
        }
        const token_match = array_content.slice(index).match(/^(\d+)(?:\s+0\s+R)?/);
        if (!token_match) {
            break;
        }
        const token = token_match[1];
        index += token_match[0].length;
        if (token_match[0].includes('R')) {
            entries.push({ kind: 'ref', object_number: Number.parseInt(token, 10) });
        } else {
            entries.push({ kind: 'mcid', value: Number.parseInt(token, 10) });
        }
    }
    return entries;
}

function parse_k_entries(dict: string): StructKEntry[] {
    const k_index = dict.indexOf('/K');
    if (k_index < 0) {
        return [];
    }
    let index = k_index + 2;
    while (index < dict.length && dict[index] !== '[' && !/\d/.test(dict[index]) && dict[index] !== '<') {
        index += 1;
    }
    if (dict[index] === '[') {
        const end = dict.indexOf(']', index);
        if (end < 0) {
            return [];
        }
        return parse_k_array_content(dict.slice(index + 1, end));
    }
    if (dict[index] === '<') {
        let depth = 0;
        const start = index;
        while (index < dict.length - 1) {
            if (dict[index] === '<' && dict[index + 1] === '<') {
                depth += 1;
                index += 2;
                continue;
            }
            if (dict[index] === '>' && dict[index + 1] === '>') {
                depth -= 1;
                index += 2;
                if (depth === 0) {
                    break;
                }
                continue;
            }
            index += 1;
        }
        return [{ kind: 'inline', raw: dict.slice(start, index) }];
    }
    const single_match = dict.slice(index).match(/^(\d+)(?:\s+0\s+R)?/);
    if (!single_match) {
        return [];
    }
    if (single_match[0].includes('R')) {
        return [{ kind: 'ref', object_number: Number.parseInt(single_match[1], 10) }];
    }
    return [{ kind: 'mcid', value: Number.parseInt(single_match[1], 10) }];
}

export function parse_struct_elem_dict(object_number: number, dict: string): StructElemNode | null {
    if (!dict.includes('/Type /StructElem')) {
        return null;
    }
    const struct_type = dict.match(/\/S\s+\/(\S+)/)?.[1];
    if (!struct_type) {
        return null;
    }
    const attributes_match = dict.match(/\/A\s+(\[[\s\S]*?\]|<[\s\S]*?>>)/);
    return {
        object_number,
        struct_type,
        parent_number: parse_object_ref(dict, 'P'),
        page_number: parse_object_ref(dict, 'Pg'),
        k_entries: parse_k_entries(dict),
        attributes_raw: attributes_match?.[1] ?? null,
    };
}

function format_k_entry(entry: StructKEntry): string {
    if (entry.kind === 'ref') {
        return `${entry.object_number} 0 R`;
    }
    if (entry.kind === 'mcid') {
        return String(entry.value);
    }
    return entry.raw;
}

function serialize_k_entries(entries: StructKEntry[]): string {
    if (entries.length === 0) {
        return '';
    }
    if (entries.length === 1) {
        const only = entries[0];
        if (only.kind === 'ref') {
            return `/K ${only.object_number} 0 R`;
        }
        if (only.kind === 'mcid') {
            return `/K ${only.value}`;
        }
        return `/K ${only.raw}`;
    }
    return `/K [ ${entries.map(format_k_entry).join(' ')} ]`;
}

export function serialize_struct_elem_dict(node: StructElemNode): string {
    const parts = [
        '<< /Type /StructElem',
        `/S /${node.struct_type}`,
        node.parent_number !== null ? `/P ${node.parent_number} 0 R` : '',
        node.page_number !== null ? `/Pg ${node.page_number} 0 R` : '',
        serialize_k_entries(node.k_entries),
        node.attributes_raw ? `/A ${node.attributes_raw}` : '',
        '>>',
    ];
    return parts.filter(Boolean).join('\n');
}

export function replace_ref_in_k_entries(
    entries: StructKEntry[],
    removed_ref: number,
    replacement: StructKEntry[]
): StructKEntry[] {
    const expanded: StructKEntry[] = [];
    for (const entry of entries) {
        if (entry.kind === 'ref' && entry.object_number === removed_ref) {
            expanded.push(...replacement);
            continue;
        }
        expanded.push(entry);
    }
    return expanded;
}
