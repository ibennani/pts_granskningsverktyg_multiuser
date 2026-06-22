/**
 * @fileoverview Enhetstester för serverindex och uppladdningsdubbletter vid äldre filnamn.
 */

import { describe, it, expect } from '@jest/globals';
import {
    is_upload_duplicate_filename,
    partition_files_for_upload,
    filenames_existing_on_server,
    find_server_media_filename_match,
    merge_uploaded_media_filenames
} from '../../js/logic/audit_media_server_index.ts';

describe('is_upload_duplicate_filename', () => {
    it('blockerar när filnamn finns i listan och på servern', () => {
        const server = new Set(['bild.png']);
        expect(is_upload_duplicate_filename('bild.png', ['bild.png'], server)).toBe(true);
    });

    it('tillåter uppladdning när filnamn bara är äldre referens utan serverfil', () => {
        const server = new Set<string>();
        expect(is_upload_duplicate_filename('utfälld_meny.png', ['utfälld_meny.png'], server)).toBe(false);
    });

    it('tillåter uppladdning när serverindex ännu inte laddats', () => {
        expect(is_upload_duplicate_filename('utfälld_meny.png', ['utfälld_meny.png'], null)).toBe(false);
    });
});

describe('partition_files_for_upload', () => {
    it('delar upp nya filer och riktiga dubbletter', () => {
        const files = [
            new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
            new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
            new File(['c'], 'c.jpg', { type: 'image/jpeg' })
        ];
        const server = new Set(['b.jpg']);
        const result = partition_files_for_upload(files, ['b.jpg', 'legacy.png'], server);
        expect(result.duplicate_names).toEqual(['b.jpg']);
        expect(result.new_files.map((file) => file.name)).toEqual(['a.jpg', 'c.jpg']);
    });

    it('tillåter fil med samma namn som äldre referens utan serverfil', () => {
        const files = [new File(['x'], 'legacy.png', { type: 'image/png' })];
        const server = new Set<string>();
        const result = partition_files_for_upload(files, ['legacy.png'], server);
        expect(result.duplicate_names).toEqual([]);
        expect(result.new_files.map((file) => file.name)).toEqual(['legacy.png']);
    });
});

describe('filenames_existing_on_server', () => {
    it('returnerar bara filnamn som finns på servern när index är laddat', () => {
        const server = new Set(['finns.png']);
        expect(filenames_existing_on_server(['finns.png', 'legacy.png'], server)).toEqual(['finns.png']);
    });

    it('försöker radera alla när serverindex saknas', () => {
        expect(filenames_existing_on_server(['legacy.png'], null)).toEqual(['legacy.png']);
    });
});

describe('find_server_media_filename_match', () => {
    const server = new Set(['Översikt över menyn.png', 'Översikt över menyn (5).png']);

    it('matchar exakt filnamn', () => {
        expect(find_server_media_filename_match('Översikt över menyn (5).png', server)).toBe(
            'Översikt över menyn (5).png'
        );
    });

    it('matchar skiftlägesvariant', () => {
        expect(find_server_media_filename_match('översikt över menyn.png', server)).toBe(
            'Översikt över menyn.png'
        );
    });
});

describe('merge_uploaded_media_filenames', () => {
    it('ersätter lokalt namn och äldre varianter med samma bas', () => {
        const result = merge_uploaded_media_filenames(
            ['Översikt över menyn.png', 'Översikt över menyn (5).png', 'annan.png'],
            'Översikt över menyn.png',
            'Översikt över menyn (6).png'
        );
        expect(result).toEqual(['annan.png', 'Översikt över menyn (6).png']);
    });
});
