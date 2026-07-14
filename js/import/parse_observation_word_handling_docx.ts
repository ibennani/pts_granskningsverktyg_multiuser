/**
 * @fileoverview Läser handläggar-Word: röda tabellceller med H4 och observationstext.
 */
import JSZip from 'jszip';
import {
    read_observation_word_audit_marker_from_docx,
} from '../../shared/export/observation_word_audit_marker.js';
import { OBSERVATION_BORDER_COLOR } from '../export/export_observation_texts_word_constants.js';
import {
    children_by_local_name,
    docx_paragraphs_to_markdown,
    first_child_by_local_name,
    get_w_attr,
    W_NS,
} from './docx_paragraphs_to_markdown.js';
import type { ObservationWordImportParseResult, ParsedHandlingBlock } from './observation_word_import_types.js';

const DEFICIENCY_HEADING_RE = /^(?:Brist-id|Deficiency ID|Avviks-ID)\s+(\d+)\s*$/i;

function normalize_border_color(raw: string): string {
    return String(raw || '').replace(/^#/, '').trim().toUpperCase();
}

function cell_has_handling_border(cell: Element): boolean {
    const tc_pr = first_child_by_local_name(cell, 'tcPr');
    if (!tc_pr) return false;
    const borders = first_child_by_local_name(tc_pr, 'tcBorders');
    if (!borders) return false;
    for (const side of ['top', 'bottom', 'left', 'right']) {
        const side_el = first_child_by_local_name(borders, side);
        if (!side_el) return false;
        const color = normalize_border_color(get_w_attr(side_el, 'color'));
        if (color !== OBSERVATION_BORDER_COLOR) return false;
    }
    return true;
}

function is_heading4_paragraph(paragraph: Element): boolean {
    const p_pr = first_child_by_local_name(paragraph, 'pPr');
    if (!p_pr) return false;
    const p_style = first_child_by_local_name(p_pr, 'pStyle');
    if (p_style) {
        const val = get_w_attr(p_style, 'val');
        if (/^Heading4$/i.test(val) || /^Rubrik4$/i.test(val)) return true;
    }
    const outline = first_child_by_local_name(p_pr, 'outlineLvl');
    if (outline) {
        const level = parseInt(get_w_attr(outline, 'val'), 10);
        return level === 3;
    }
    return false;
}

function paragraph_plain_text(paragraph: Element): string {
    const parts: string[] = [];
    for (const run of children_by_local_name(paragraph, 'r')) {
        for (const text_el of children_by_local_name(run, 't')) {
            parts.push(text_el.textContent || '');
        }
    }
    return parts.join('').trim();
}

function parse_deficiency_id_from_heading(paragraph: Element): string | null {
    const text = paragraph_plain_text(paragraph);
    const match = text.match(DEFICIENCY_HEADING_RE);
    if (!match) return null;
    return match[1];
}

function collect_paragraphs_in_cell(cell: Element): Element[] {
    const paragraphs: Element[] = [];
    for (const child of Array.from(cell.children)) {
        if (child.localName === 'p') {
            paragraphs.push(child);
        }
    }
    return paragraphs;
}

function parse_handling_cell(cell: Element, rel_map: Map<string, string>): ParsedHandlingBlock | null {
    const paragraphs = collect_paragraphs_in_cell(cell);
    if (paragraphs.length === 0) return null;

    let heading_index = -1;
    let id_number: string | null = null;
    for (let i = 0; i < paragraphs.length; i += 1) {
        if (!is_heading4_paragraph(paragraphs[i])) continue;
        const parsed_id = parse_deficiency_id_from_heading(paragraphs[i]);
        if (parsed_id) {
            heading_index = i;
            id_number = parsed_id;
            break;
        }
    }
    if (!id_number || heading_index < 0) return null;

    const body_paragraphs = paragraphs.slice(heading_index + 1);
    const observation_markdown = docx_paragraphs_to_markdown(body_paragraphs, rel_map);
    return { id_number, observation_markdown };
}

function collect_handling_cells(root: Element): Element[] {
    const cells: Element[] = [];
    for (const table of children_by_local_name(root, 'tbl')) {
        for (const row of children_by_local_name(table, 'tr')) {
            for (const cell of children_by_local_name(row, 'tc')) {
                if (cell_has_handling_border(cell)) {
                    cells.push(cell);
                }
            }
        }
    }
    return cells;
}

function build_relationship_map(rels_xml: string): Map<string, string> {
    const rel_map = new Map<string, string>();
    const parser = new DOMParser();
    const doc = parser.parseFromString(rels_xml, 'application/xml');
    for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        const type = rel.getAttribute('Type') || '';
        if (!id || !target) continue;
        if (type.includes('/hyperlink')) {
            rel_map.set(id, target);
        }
    }
    return rel_map;
}

function parse_document_xml(document_xml: string, rel_map: Map<string, string>): ParsedHandlingBlock[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(document_xml, 'application/xml');
    const body = doc.getElementsByTagNameNS(W_NS, 'body')[0]
        || doc.getElementsByTagName('w:body')[0]
        || first_child_by_local_name(doc.documentElement, 'body');
    if (!body) return [];

    const blocks: ParsedHandlingBlock[] = [];
    for (const cell of collect_handling_cells(body)) {
        const block = parse_handling_cell(cell, rel_map);
        if (block) blocks.push(block);
    }
    return blocks;
}

/**
 * Läser en .docx-buffer och returnerar importblock från röda celler.
 */
export async function parse_observation_word_handling_docx(
    file_bytes: ArrayBuffer | Uint8Array
): Promise<ObservationWordImportParseResult> {
    try {
        const audit_marker = await read_observation_word_audit_marker_from_docx(file_bytes);
        const zip = await JSZip.loadAsync(file_bytes);
        const document_entry = zip.file('word/document.xml');
        if (!document_entry) {
            return {
                ok: false,
                blocks: [],
                error_key: 'observation_word_import_error_not_docx',
                audit_marker,
            };
        }

        const document_xml = await document_entry.async('string');
        let rel_map = new Map<string, string>();
        const rels_entry = zip.file('word/_rels/document.xml.rels');
        if (rels_entry) {
            rel_map = build_relationship_map(await rels_entry.async('string'));
        }

        const blocks = parse_document_xml(document_xml, rel_map);
        if (blocks.length === 0) {
            return {
                ok: false,
                blocks: [],
                error_key: 'observation_word_import_error_no_handling_blocks',
                audit_marker,
            };
        }

        return { ok: true, blocks, audit_marker };
    } catch {
        return { ok: false, blocks: [], error_key: 'observation_word_import_error_parse_failed' };
    }
}

export {
    cell_has_handling_border,
    is_heading4_paragraph,
    parse_deficiency_id_from_heading,
    parse_document_xml,
};
