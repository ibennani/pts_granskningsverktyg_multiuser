/**
 * @fileoverview Sätter /Alt på Figure-taggar i taggade PDF:er enligt Adobe PDF-referensen (ISO 32000).
 */
import {
    pdf_buffer_contains_marker,
    read_object_dictionary_at,
    replace_object_bodies_incrementally,
} from './pdf_incremental_object_replace.js';
import { parse_struct_elem_dict, type StructElemNode } from './pdf_struct_elem.js';

function decode_basic_html_entities(text: string): string {
    return text
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function resolve_screenshots_appendix_html_scope(html_content: string): string | null {
    if (!html_content.includes('screenshots-appendix')) {
        return null;
    }

    const main_match = html_content.match(
        /<main\b[^>]*\bclass="[^"]*\bscreenshots-appendix-document\b[^"]*"[^>]*>([\s\S]*?)<\/main>/i
    );
    if (main_match?.[1] !== undefined) {
        return main_match[1];
    }

    return html_content;
}

/** Extraherar alt-text från bilder i bilaga 3 HTML (exportfilnamn). */
export function extract_screenshots_appendix_img_alt_texts(html_content: string): string[] {
    const scope = resolve_screenshots_appendix_html_scope(html_content);
    if (!scope) {
        return [];
    }

    const img_pattern = /<img\b[^>]*\balt="([^"]*)"[^>]*>/gi;
    const alt_texts: string[] = [];

    for (const img_match of scope.matchAll(img_pattern)) {
        const alt_text = img_match[1]?.trim();
        if (alt_text) {
            alt_texts.push(decode_basic_html_entities(alt_text));
        }
    }

    return alt_texts;
}

/** Escapar PDF literalsträng enligt PDF-syntax. */
export function format_pdf_literal_string(text: string): string {
    const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    return `(${escaped})`;
}

/** Lägger till eller ersätter /Alt i ett StructElem-dictionary. */
export function upsert_alt_in_struct_dict(dict_body: string, alt_text: string): string {
    const alt_entry = `/Alt ${format_pdf_literal_string(alt_text)}`;
    if (/\/Alt\s/.test(dict_body)) {
        return dict_body.replace(
            /\/Alt\s+(\((?:\\.|[^\\()])*\)|<[^>]+>)/,
            alt_entry
        );
    }
    return dict_body.replace(/<<\s*/, `<<\n${alt_entry}\n`);
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

function find_document_struct_number(buffer: Buffer): number | null {
    const tail = buffer.subarray(Math.max(0, buffer.length - 4096)).toString('latin1');
    const trailer_index = tail.lastIndexOf('trailer');
    const root_match = tail.slice(trailer_index).match(/\/Root\s+(\d+)\s+\d+\s+R/);
    if (!root_match) {
        return null;
    }
    const catalog_dict = read_object_dictionary_at(buffer, Number.parseInt(root_match[1], 10));
    const struct_root_number = catalog_dict.match(/\/StructTreeRoot\s+(\d+)\s+\d+\s+R/)?.[1];
    if (!struct_root_number) {
        return null;
    }
    const struct_root_dict = read_object_dictionary_at(buffer, Number.parseInt(struct_root_number, 10));
    const document_ref = struct_root_dict.match(/\/K\s+(\d+)\s+\d+\s+R/)?.[1];
    return document_ref ? Number.parseInt(document_ref, 10) : null;
}

function collect_figure_object_numbers_in_order(
    nodes: Map<number, StructElemNode>,
    start_number: number
): number[] {
    const figures: number[] = [];
    const visited = new Set<number>();

    function walk(object_number: number): void {
        if (visited.has(object_number)) {
            return;
        }
        visited.add(object_number);
        const node = nodes.get(object_number);
        if (!node) {
            return;
        }
        if (node.struct_type === 'Figure') {
            figures.push(object_number);
        }
        for (const entry of node.k_entries) {
            if (entry.kind === 'ref') {
                walk(entry.object_number);
            }
        }
    }

    walk(start_number);
    return figures;
}
/**
 * Sätter /Alt på Figure-taggar i dokumentordning utifrån HTML alt-attribut (bilaga 3).
 */
export function apply_figure_alt_texts_from_html(pdf_buffer: Buffer, html_content: string): Buffer {
    if (!pdf_buffer_contains_marker(pdf_buffer, 'StructTreeRoot')) {
        return pdf_buffer;
    }

    const alt_texts = extract_screenshots_appendix_img_alt_texts(html_content);
    if (alt_texts.length === 0) {
        return pdf_buffer;
    }

    const nodes = load_struct_elem_nodes(pdf_buffer);
    const document_number = find_document_struct_number(pdf_buffer);
    if (document_number === null) {
        return pdf_buffer;
    }

    const figure_numbers = collect_figure_object_numbers_in_order(nodes, document_number);
    if (figure_numbers.length === 0) {
        return pdf_buffer;
    }

    const object_bodies = new Map<number, string>();
    const pair_count = Math.min(alt_texts.length, figure_numbers.length);
    for (let index = 0; index < pair_count; index += 1) {
        const object_number = figure_numbers[index]!;
        const dict = read_object_dictionary_at(pdf_buffer, object_number);
        object_bodies.set(object_number, upsert_alt_in_struct_dict(dict, alt_texts[index]!));
    }

    if (object_bodies.size === 0) {
        return pdf_buffer;
    }

    return replace_object_bodies_incrementally(pdf_buffer, object_bodies);
}
