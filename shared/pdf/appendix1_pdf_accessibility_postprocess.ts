/**
 * @fileoverview Efterbearbetar Bilaga 1-PDF: markerar omslagssidan som Artifact utan att ta bort taggträdet.
 */
import {
    pdf_buffer_contains_marker,
    read_flate_stream_at,
    read_object_dictionary_at,
    replace_flate_stream_object_incrementally,
} from './pdf_incremental_object_replace.js';

const PAGE_TYPE_PATTERN = /\/Type\s+\/Page\b/;
const PAGES_TYPE_PATTERN = /\/Type\s+\/Pages\b/;

function parse_object_ref(dict: string, key: string): number | null {
    const match = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
    if (!match) {
        return null;
    }
    return Number.parseInt(match[1], 10);
}

function parse_object_ref_list(dict: string, key: string): number[] {
    const match = dict.match(new RegExp(`/${key}\\s+\\[([^\\]]+)\\]`));
    if (!match) {
        return [];
    }
    return [...match[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((item) => Number.parseInt(item[1], 10));
}

function resolve_first_page_contents_object(buffer: Buffer): number {
    const catalog_number = find_catalog_object_number(buffer);
    const catalog_dict = read_object_dictionary_at(buffer, catalog_number);
    const pages_number = parse_object_ref(catalog_dict, 'Pages');
    if (pages_number === null) {
        throw new Error('PDF saknar Pages-träd');
    }
    return resolve_page_contents_from_pages_node(buffer, pages_number);
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

function resolve_page_contents_from_pages_node(buffer: Buffer, pages_object_number: number): number {
    const dict = read_object_dictionary_at(buffer, pages_object_number);
    if (PAGES_TYPE_PATTERN.test(dict)) {
        const kids = parse_object_ref_list(dict, 'Kids');
        if (kids.length === 0) {
            throw new Error('PDF Pages-nod saknar Kids');
        }
        return resolve_page_contents_from_pages_node(buffer, kids[0]);
    }
    if (PAGE_TYPE_PATTERN.test(dict)) {
        return resolve_page_contents_object(buffer, pages_object_number);
    }
    throw new Error('PDF Pages-nod saknar Page eller Pages');
}

function resolve_page_contents_object(buffer: Buffer, page_object_number: number): number {
    const dict = read_object_dictionary_at(buffer, page_object_number);
    const single = parse_object_ref(dict, 'Contents');
    if (single !== null) {
        return single;
    }
    const list = parse_object_ref_list(dict, 'Contents');
    if (list.length === 0) {
        throw new Error('PDF-sida saknar Contents');
    }
    return list[0];
}

function wrap_stream_as_artifact(decoded_stream: string): string {
    const trimmed = decoded_stream.trimEnd();
    if (trimmed.includes('/Artifact')) {
        return decoded_stream;
    }
    return `/Artifact BMC\n${trimmed}\nEMC\n`;
}

/**
 * Markerar första sidans innehållsström som Artifact (omslag) och bevarar taggträdet.
 */
export function postprocess_appendix1_pdf_accessibility(pdf_buffer: Buffer): Buffer {
    if (!pdf_buffer_contains_marker(pdf_buffer, 'StructTreeRoot')) {
        return pdf_buffer;
    }

    const contents_object = resolve_first_page_contents_object(pdf_buffer);
    const updated = replace_flate_stream_object_incrementally(pdf_buffer, contents_object, wrap_stream_as_artifact);

    if (!pdf_buffer_contains_marker(updated, 'StructTreeRoot')) {
        throw new Error('PDF-efterbearbetning tog bort StructTreeRoot');
    }

    return updated;
}

/** Hjälp för tester: läser dekodad contents-ström för första sidan. */
export function read_first_page_contents_for_tests(buffer: Buffer): string {
    const contents_object = resolve_first_page_contents_object(buffer);
    return read_flate_stream_at(buffer, contents_object);
}
