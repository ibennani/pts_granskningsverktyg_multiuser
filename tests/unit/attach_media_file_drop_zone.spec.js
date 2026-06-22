/**
 * @fileoverview Enhetstester för mediafil i drag-och-släpp-zon.
 */

import {
    filter_acceptable_media_files,
    is_acceptable_media_file
} from '../../js/components/media/attach_media_file_drop_zone.js';

describe('is_acceptable_media_file', () => {
    test('godkänner bilder via mime', () => {
        expect(is_acceptable_media_file({ type: 'image/png', name: 'a.png' })).toBe(true);
    });

    test('godkänner video via mime', () => {
        expect(is_acceptable_media_file({ type: 'video/mp4', name: 'clip.mp4' })).toBe(true);
    });

    test('godkänner heic via filändelse när mime saknas', () => {
        expect(is_acceptable_media_file({ type: '', name: 'foto.heic' })).toBe(true);
    });

    test('avvisar okända filtyper', () => {
        expect(is_acceptable_media_file({ type: 'application/pdf', name: 'rapport.pdf' })).toBe(false);
    });

    test('avvisar svg', () => {
        expect(is_acceptable_media_file({ type: 'image/svg+xml', name: 'icon.svg' })).toBe(false);
    });
});

describe('filter_acceptable_media_files', () => {
    test('returnerar alla giltiga filer i ordning', () => {
        const files = [
            { type: 'image/png', name: 'a.png', size: 100 },
            { type: 'application/pdf', name: 'b.pdf', size: 100 },
            { type: 'image/jpeg', name: 'c.jpg', size: 100 }
        ];
        const filtered = filter_acceptable_media_files(files, 1000);
        expect(filtered.map((file) => file.name)).toEqual(['a.png', 'c.jpg']);
    });

    test('filtrerar bort för stora filer', () => {
        const files = [{ type: 'image/png', name: 'stor.png', size: 5000 }];
        expect(filter_acceptable_media_files(files, 1000)).toEqual([]);
    });
});
