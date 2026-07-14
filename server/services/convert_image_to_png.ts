/**
 * @fileoverview Konverterar en bildfil på disk till PNG-format.
 */

import fs from 'fs/promises';
import sharp from 'sharp';

export class ImagePngConversionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ImagePngConversionError';
    }
}

export type ConvertImageFileToPngResult = {
    size: number;
};

/**
 * Läser en bildfil, konverterar till PNG och skriver tillbaka till samma sökväg.
 * Animerade GIF blir första bildrutan.
 */
export async function convert_image_file_to_png(file_path: string): Promise<ConvertImageFileToPngResult> {
    let input_buffer: Buffer;
    try {
        input_buffer = await fs.readFile(file_path);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new ImagePngConversionError(`Kunde inte läsa bildfilen: ${detail}`);
    }

    let png_buffer: Buffer;
    try {
        png_buffer = await sharp(input_buffer, { animated: false }).png().toBuffer();
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new ImagePngConversionError(`Kunde inte konvertera bilden till PNG: ${detail}`);
    }

    try {
        await fs.writeFile(file_path, png_buffer);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new ImagePngConversionError(`Kunde inte spara PNG-filen: ${detail}`);
    }

    return { size: png_buffer.length };
}
