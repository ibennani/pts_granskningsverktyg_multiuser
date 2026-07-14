/**
 * @jest-environment node
 */
import { describe, test, expect, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import {
    convert_image_file_to_png,
    ImagePngConversionError
} from '../../server/services/convert_image_to_png.js';

describe('convert_image_file_to_png', () => {
    const temp_paths: string[] = [];

    afterEach(async () => {
        await Promise.all(
            temp_paths.splice(0).map((file_path) => fs.unlink(file_path).catch(() => {}))
        );
    });

    async function create_temp_jpeg(): Promise<string> {
        const file_path = path.join(os.tmpdir(), `gv-test-${Date.now()}-${Math.random()}.jpg`);
        temp_paths.push(file_path);
        const jpeg_buffer = await sharp({
            create: {
                width: 4,
                height: 4,
                channels: 3,
                background: { r: 200, g: 100, b: 50 }
            }
        })
            .jpeg()
            .toBuffer();
        await fs.writeFile(file_path, jpeg_buffer);
        return file_path;
    }

    test('konverterar JPEG till PNG på disk', async () => {
        const file_path = await create_temp_jpeg();
        const before = await fs.readFile(file_path);

        const result = await convert_image_file_to_png(file_path);
        const after = await fs.readFile(file_path);

        expect(result.size).toBe(after.length);
        expect(after.length).toBeGreaterThan(0);
        expect(after.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
        expect(before.equals(after)).toBe(false);
    });

    test('kastar tydligt fel för ogiltig bilddata', async () => {
        const file_path = path.join(os.tmpdir(), `gv-test-invalid-${Date.now()}.jpg`);
        temp_paths.push(file_path);
        await fs.writeFile(file_path, 'inte en bild');

        await expect(convert_image_file_to_png(file_path)).rejects.toBeInstanceOf(
            ImagePngConversionError
        );
    });
});
