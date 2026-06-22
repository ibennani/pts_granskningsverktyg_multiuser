/**
 * @fileoverview Tester för sanering av mediefilnamn och MIME-validering.
 */

import {
    decode_multipart_original_filename,
    get_media_display_kind,
    is_allowed_media_mime,
    is_image_filename,
    is_previewable_image_filename,
    resolve_unique_media_filename,
    resolve_upload_media_filename,
    sanitize_media_filename
} from '../../shared/media/sanitize_media_filename.js';
import { MEDIA_MAX_UPLOAD_BYTES, format_media_max_upload_size_label } from '../../shared/constants/media_upload_limits.js';

describe('sanitize_media_filename', () => {
    test('tar bort sökvägar och farliga tecken', () => {
        expect(sanitize_media_filename('../hemlig.png')).toBe('hemlig.png');
        expect(sanitize_media_filename('folder/bild.jpg')).toBe('bild.jpg');
        expect(sanitize_media_filename('  test.png  ')).toBe('test.png');
    });

    test('returnerar null för ogiltiga namn', () => {
        expect(sanitize_media_filename('')).toBeNull();
        expect(sanitize_media_filename('   ')).toBeNull();
        expect(sanitize_media_filename('..')).toBeNull();
    });
});

describe('decode_multipart_original_filename', () => {
    test('återställer svenska tecken från multer-latin1', () => {
        const mojibake = Buffer.from('översikt.png', 'utf8').toString('latin1');
        expect(decode_multipart_original_filename(mojibake)).toBe('översikt.png');
    });
});

describe('resolve_upload_media_filename', () => {
    test('använder avkodat filnamn utan suffix', () => {
        const mojibake = Buffer.from('översikt.png', 'utf8').toString('latin1');
        expect(resolve_upload_media_filename(mojibake)).toBe('översikt.png');
    });
});

describe('resolve_unique_media_filename', () => {
    test('lägger till suffix vid kollision', () => {
        const existing = new Set(['bild.png']);
        const result = resolve_unique_media_filename('bild.png', (name) => existing.has(name));
        expect(result).toBe('bild (2).png');
    });
});

describe('media mime helpers', () => {
    test('vitlistar tillåtna typer', () => {
        expect(is_allowed_media_mime('image/png')).toBe(true);
        expect(is_allowed_media_mime('video/mp4')).toBe(true);
        expect(is_allowed_media_mime('application/pdf')).toBe(false);
    });

    test('känner igen bildfiländelser inklusive heic', () => {
        expect(is_image_filename('skarm.png')).toBe(true);
        expect(is_image_filename('foto.heic')).toBe(true);
        expect(is_image_filename('film.mp4')).toBe(false);
    });

    test('get_media_display_kind skiljer förhandsvisningsbara bilder från video', () => {
        expect(get_media_display_kind('a.jpg')).toBe('previewable_image');
        expect(get_media_display_kind('b.heic')).toBe('image');
        expect(get_media_display_kind('c.mp4')).toBe('video');
        expect(is_previewable_image_filename('a.webp')).toBe(true);
        expect(is_previewable_image_filename('b.heic')).toBe(false);
    });
});

describe('media_upload_limits', () => {
    test('har 25 MiB som maxstorlek', () => {
        expect(MEDIA_MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    });

    test('format_media_max_upload_size_label returnerar 25 MB', () => {
        expect(format_media_max_upload_size_label()).toBe('25 MB');
    });
});
