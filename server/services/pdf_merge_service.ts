/**
 * @fileoverview Slår ihop flera PDF-buffertar till en fil (t.ex. chunkad bilaga 3).
 */

import { PDFDocument } from 'pdf-lib';

export async function merge_pdf_buffers(buffers: Buffer[]): Promise<Buffer> {
    if (buffers.length === 0) {
        throw new Error('Inga PDF-delar att slå ihop');
    }
    if (buffers.length === 1) {
        return buffers[0]!;
    }

    const merged = await PDFDocument.create();
    for (const buffer of buffers) {
        const source = await PDFDocument.load(buffer);
        const copied = await merged.copyPages(source, source.getPageIndices());
        copied.forEach((page) => merged.addPage(page));
    }
    return Buffer.from(await merged.save());
}
