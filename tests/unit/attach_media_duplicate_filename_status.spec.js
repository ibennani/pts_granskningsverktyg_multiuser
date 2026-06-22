/**
 * @fileoverview Enhetstester för dubblettmeddelanden vid bifoga media.
 */

import { describe, it, expect } from '@jest/globals';
import {
    build_attach_media_duplicate_filenames_message,
    build_attach_media_upload_success_message,
    build_attach_media_upload_renamed_conflict_message,
    build_attach_media_local_files_added_message,
    partition_files_by_existing_filenames
} from '../../js/components/media/attach_media_duplicate_filename_status.ts';

describe('build_attach_media_duplicate_filenames_message', () => {
    const escape_html = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    it('formaterar en fil för krav med strong', () => {
        const t = (key) => {
            const map = {
                attach_media_file_already_in_requirement_one_before: 'Filen ',
                attach_media_file_already_in_requirement_one_after: ' finns redan i det aktuella kravet.'
            };
            return map[key] || key;
        };
        const html = build_attach_media_duplicate_filenames_message(
            t,
            'requirement',
            ['hej.jpg'],
            escape_html
        );
        expect(html).toBe('Filen <strong>hej.jpg</strong> finns redan i det aktuella kravet.');
    });

    it('formaterar flera filer för stickprov med strong', () => {
        const t = (key) => {
            const map = {
                attach_media_file_already_in_sample_many_before: 'Filerna ',
                attach_media_file_already_in_sample_many_after: ' finns redan i det aktuella stickprovet.'
            };
            return map[key] || key;
        };
        const html = build_attach_media_duplicate_filenames_message(
            t,
            'sample',
            ['a.jpg', 'b.jpg'],
            escape_html
        );
        expect(html).toBe(
            'Filerna <strong>a.jpg</strong>, <strong>b.jpg</strong> finns redan i det aktuella stickprovet.'
        );
    });
});

describe('build_attach_media_upload_success_message', () => {
    const escape_html = (value: string) => value;

    it('visar filnamn för en uppladdad fil', () => {
        const t = (key) => {
            const map = {
                attach_media_upload_success_one_before: 'Filen ',
                attach_media_upload_success_one_after: ' laddades upp.'
            };
            return map[key] || key;
        };
        const html = build_attach_media_upload_success_message(t, escape_html, 1, 'hej.jpg');
        expect(html).toBe('Filen <strong>hej.jpg</strong> laddades upp.');
    });

    it('visar endast antal för flera uppladdade filer', () => {
        const t = (key, params) => {
            if (key === 'attach_media_upload_success_many') {
                return `${params.count} filer laddades upp.`;
            }
            return key;
        };
        const text = build_attach_media_upload_success_message(t, escape_html, 2, 'a.jpg');
        expect(text).toBe('2 filer laddades upp.');
    });
});

describe('build_attach_media_local_files_added_message', () => {
    const escape_html = (value: string) => value;

    it('visar filnamn för en tillagd lokal fil', () => {
        const t = (key) => {
            const map = {
                attach_media_local_file_added_one_before: 'Filen ',
                attach_media_local_file_added_one_after: ' lades till i listan.'
            };
            return map[key] || key;
        };
        const html = build_attach_media_local_files_added_message(t, escape_html, 1, 'b.png');
        expect(html).toBe('Filen <strong>b.png</strong> lades till i listan.');
    });
});

describe('build_attach_media_upload_renamed_conflict_message', () => {
    const escape_html = (value: string) => value;

    it('formaterar omdöpt fil med strong', () => {
        const t = (key: string) => {
            const map: Record<string, string> = {
                attach_media_upload_renamed_conflict_before:
                    'En annan användare hade redan laddat upp en fil med samma filnamn. Din fil fick därför namnet ',
                attach_media_upload_renamed_conflict_after: '.'
            };
            return map[key] || key;
        };
        const html = build_attach_media_upload_renamed_conflict_message(t, escape_html, 'bild (2).png');
        expect(html).toBe(
            'En annan användare hade redan laddat upp en fil med samma filnamn. Din fil fick därför namnet <strong>bild (2).png</strong>.'
        );
    });
});

describe('partition_files_by_existing_filenames', () => {
    it('delar upp nya och dubbletter mot serverfiler', () => {
        const files = [
            new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
            new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
            new File(['c'], 'c.jpg', { type: 'image/jpeg' })
        ];
        const result = partition_files_by_existing_filenames(files, ['b.jpg'], new Set(['b.jpg']));
        expect(result.duplicate_names).toEqual(['b.jpg']);
        expect(result.new_files.map((file) => file.name)).toEqual(['a.jpg', 'c.jpg']);
    });

    it('tillåter samma filnamn som äldre referens utan serverfil', () => {
        const files = [new File(['x'], 'legacy.png', { type: 'image/png' })];
        const result = partition_files_by_existing_filenames(files, ['legacy.png'], new Set());
        expect(result.duplicate_names).toEqual([]);
        expect(result.new_files.map((file) => file.name)).toEqual(['legacy.png']);
    });
});
