/**
 * @fileoverview Inkrementell PDF-uppdatering: ersätter ett objekt utan att skriva om hela filen.
 * Bevarar StructTreeRoot och övriga taggar (pdf-lib tar bort dem vid save).
 */
import zlib from 'node:zlib';

export interface PdfTrailerInfo {
    size: number;
    root_ref: string;
    info_ref: string | null;
    prev_xref_offset: number;
}

export interface PdfObjectLocation {
    object_number: number;
    generation: number;
    offset: number;
}

const PDF_EOF = '%%EOF';

function read_latin1(buffer: Buffer): string {
    return buffer.toString('latin1');
}

function find_last_startxref(buffer: Buffer): number {
    const tail_bytes = buffer.subarray(Math.max(0, buffer.length - 4096));
    const text = read_latin1(tail_bytes);
    const marker = 'startxref';
    const marker_index = text.lastIndexOf(marker);
    if (marker_index < 0) {
        throw new Error('PDF saknar startxref');
    }
    let line_start = marker_index + marker.length;
    while (line_start < text.length && (text[line_start] === '\r' || text[line_start] === '\n')) {
        line_start += 1;
    }
    const line_end = text.indexOf('\n', line_start);
    const raw = text.slice(line_start, line_end >= 0 ? line_end : undefined).trim();
    const offset = Number.parseInt(raw, 10);
    if (!Number.isFinite(offset) || offset < 0) {
        throw new Error('Ogiltigt startxref-värde');
    }
    return offset;
}

function parse_trailer_at_xref(buffer: Buffer, xref_offset: number): PdfTrailerInfo {
    const text = read_latin1(buffer);
    const trailer_index = text.indexOf('trailer', xref_offset);
    if (trailer_index < 0) {
        throw new Error('PDF saknar trailer');
    }
    const dict_start = text.indexOf('<<', trailer_index);
    const dict_end = text.indexOf('>>', dict_start);
    if (dict_start < 0 || dict_end < 0) {
        throw new Error('PDF-trailer saknar dictionary');
    }
    const dict = text.slice(dict_start, dict_end + 2);
    const size_match = dict.match(/\/Size\s+(\d+)/);
    const root_match = dict.match(/\/Root\s+(\d+\s+\d+\s+R)/);
    if (!size_match || !root_match) {
        throw new Error('PDF-trailer saknar Size eller Root');
    }
    const info_match = dict.match(/\/Info\s+(\d+\s+\d+\s+R)/);
    return {
        size: Number.parseInt(size_match[1], 10),
        root_ref: root_match[1],
        info_ref: info_match?.[1] ?? null,
        prev_xref_offset: xref_offset,
    };
}

function parse_trailer_prev(buffer: Buffer, xref_offset: number): number | null {
    const text = read_latin1(buffer);
    const trailer_index = text.indexOf('trailer', xref_offset);
    if (trailer_index < 0) {
        return null;
    }
    const dict_start = text.indexOf('<<', trailer_index);
    const dict_end = text.indexOf('>>', dict_start);
    if (dict_start < 0 || dict_end < 0) {
        return null;
    }
    const dict = text.slice(dict_start, dict_end + 2);
    const prev_match = dict.match(/\/Prev\s+(\d+)/);
    if (!prev_match) {
        return null;
    }
    return Number.parseInt(prev_match[1], 10);
}

function find_object_location(buffer: Buffer, object_number: number): PdfObjectLocation | null {
    let xref_offset = find_last_startxref(buffer);
    for (let step = 0; step < 32; step += 1) {
        const location = parse_xref_entry(buffer, xref_offset, object_number);
        if (location) {
            return location;
        }
        const prev = parse_trailer_prev(buffer, xref_offset);
        if (prev === null) {
            return null;
        }
        xref_offset = prev;
    }
    return null;
}

function parse_xref_entry(
    buffer: Buffer,
    xref_offset: number,
    object_number: number
): PdfObjectLocation | null {
    const text = read_latin1(buffer);
    const xref_index = text.indexOf('xref', xref_offset);
    if (xref_index < 0) {
        return null;
    }
    const subsection = text.slice(xref_index + 4);
    const lines = subsection.split(/\r?\n/).slice(1);
    let current_start = -1;
    let remaining = 0;

    for (const line of lines) {
        if (!line.trim()) {
            continue;
        }
        if (line.includes('trailer')) {
            break;
        }
        const header_match = line.match(/^(\d+)\s+(\d+)\s*$/);
        if (header_match) {
            current_start = Number.parseInt(header_match[1], 10);
            remaining = Number.parseInt(header_match[2], 10);
            continue;
        }
        if (remaining <= 0 || current_start < 0) {
            continue;
        }
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3 && parts[2] === 'n') {
            if (current_start === object_number) {
                return {
                    object_number: current_start,
                    generation: Number.parseInt(parts[1], 10),
                    offset: Number.parseInt(parts[0], 10),
                };
            }
        }
        current_start += 1;
        remaining -= 1;
    }
    return null;
}

function read_object_dictionary(buffer: Buffer, offset: number): string {
    const text = read_latin1(buffer);
    const dict_start = text.indexOf('<<', offset);
    if (dict_start < 0) {
        throw new Error('PDF-objekt saknar dictionary');
    }

    let depth = 0;
    let index = dict_start;
    while (index < text.length - 1) {
        if (text[index] === '<' && text[index + 1] === '<') {
            depth += 1;
            index += 2;
            continue;
        }
        if (text[index] === '>' && text[index + 1] === '>') {
            depth -= 1;
            index += 2;
            if (depth === 0) {
                return text.slice(dict_start, index);
            }
            continue;
        }
        index += 1;
    }

    throw new Error('PDF-objekt saknar avslutande >>');
}

function read_flate_stream_bytes(buffer: Buffer, offset: number): Buffer {
    const text = read_latin1(buffer);
    const stream_marker = text.indexOf('stream', offset);
    if (stream_marker < 0) {
        throw new Error('PDF-objekt saknar stream');
    }
    let data_start = stream_marker + 'stream'.length;
    if (text[data_start] === '\r') {
        data_start += 1;
    }
    if (text[data_start] === '\n') {
        data_start += 1;
    }
    const stream_end = text.indexOf('endstream', data_start);
    if (stream_end < 0) {
        throw new Error('PDF-stream saknar endstream');
    }
    return buffer.subarray(data_start, stream_end);
}

function decode_flate_stream(stream_bytes: Buffer): string {
    return zlib.inflateSync(stream_bytes).toString('latin1');
}

function encode_flate_stream(content: string): Buffer {
    return zlib.deflateSync(Buffer.from(content, 'latin1'));
}

function build_stream_object(object_number: number, encoded: Buffer): Buffer {
    const header =
        `${object_number} 0 obj\n` +
        `<< /Filter /FlateDecode /Length ${encoded.length} >>\n` +
        `stream\n`;
    const footer = `\nendstream\nendobj\n`;
    return Buffer.concat([Buffer.from(header, 'latin1'), encoded, Buffer.from(footer, 'latin1')]);
}

function build_incremental_tail(
    object_number: number,
    object_offset: number,
    xref_offset: number,
    trailer: PdfTrailerInfo
): Buffer {
    const xref =
        `xref\n${object_number} 1\n` +
        `${String(object_offset).padStart(10, '0')} 00000 n \n`;
    const info_part = trailer.info_ref ? `\n/Info ${trailer.info_ref}` : '';
    const trailer_text =
        `trailer\n<< /Size ${trailer.size}\n/Root ${trailer.root_ref}${info_part}\n/Prev ${trailer.prev_xref_offset} >>\n` +
        `startxref\n${xref_offset}\n${PDF_EOF}\n`;
    return Buffer.from(xref + trailer_text, 'latin1');
}

function build_object_tail(
    object_number: number,
    object_offset: number,
    object_bytes: Buffer,
    trailer: PdfTrailerInfo
): Buffer {
    const xref_offset = object_offset + object_bytes.length;
    return build_incremental_tail(object_number, object_offset, xref_offset, trailer);
}

/**
 * Ersätter ett objekt med nytt innehåll via inkrementell PDF-uppdatering.
 */
export function replace_object_body_incrementally(
    pdf_buffer: Buffer,
    object_number: number,
    dictionary_or_stream_body: string
): Buffer {
    const prev_xref = find_last_startxref(pdf_buffer);
    const trailer = parse_trailer_at_xref(pdf_buffer, prev_xref);
    const object_bytes = Buffer.from(`${object_number} 0 obj\n${dictionary_or_stream_body}\nendobj\n`, 'latin1');
    const object_offset = pdf_buffer.length;
    const tail = build_object_tail(object_number, object_offset, object_bytes, trailer);
    return Buffer.concat([pdf_buffer, object_bytes, tail]);
}

/**
 * Ersätter ett FlateDecode-stream-objekt och lägger till en inkrementell PDF-uppdatering.
 */
export function replace_flate_stream_object_incrementally(
    pdf_buffer: Buffer,
    object_number: number,
    transform_decoded_stream: (decoded: string) => string
): Buffer {
    const prev_xref = find_last_startxref(pdf_buffer);
    const trailer = parse_trailer_at_xref(pdf_buffer, prev_xref);
    const location = find_object_location(pdf_buffer, object_number);
    if (!location) {
        throw new Error(`PDF-objekt ${object_number} hittades inte i xref`);
    }

    const stream_bytes = read_flate_stream_bytes(pdf_buffer, location.offset);
    const decoded = decode_flate_stream(stream_bytes);
    const wrapped = transform_decoded_stream(decoded);
    const encoded = encode_flate_stream(wrapped);
    const object_bytes = build_stream_object(object_number, encoded);
    const object_offset = pdf_buffer.length;
    const tail = build_object_tail(object_number, object_offset, object_bytes, trailer);

    return Buffer.concat([pdf_buffer, object_bytes, tail]);
}

export function read_object_dictionary_at(buffer: Buffer, object_number: number): string {
    const location = find_object_location(buffer, object_number);
    if (!location) {
        throw new Error(`PDF-objekt ${object_number} hittades inte`);
    }
    return read_object_dictionary(buffer, location.offset);
}

export function read_flate_stream_at(buffer: Buffer, object_number: number): string {
    const location = find_object_location(buffer, object_number);
    if (!location) {
        throw new Error(`PDF-objekt ${object_number} hittades inte`);
    }
    const stream_bytes = read_flate_stream_bytes(buffer, location.offset);
    return decode_flate_stream(stream_bytes);
}

export function pdf_buffer_contains_marker(buffer: Buffer, marker: string): boolean {
    return buffer.includes(Buffer.from(marker, 'latin1'));
}
