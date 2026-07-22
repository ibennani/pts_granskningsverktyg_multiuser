/**
 * @fileoverview Enhetstester för validering av omdöpning av mediefiler.
 */

import { describe, expect, test } from '@jest/globals';
import {
    infer_media_mime_from_filename,
    prepare_media_rename_filename_input,
    resolve_media_rename_filename
} from '../../shared/media/resolve_media_rename_filename.js';

describe('infer_media_mime_from_filename', () => {
    test('returnerar image/png för .png', () => {
        expect(infer_media_mime_from_filename('bild.png')).toBe('image/png');
    });

    test('returnerar video/mp4 för .mp4', () => {
        expect(infer_media_mime_from_filename('klipp.mp4')).toBe('video/mp4');
    });

    test('returnerar null för okänd ändelse', () => {
        expect(infer_media_mime_from_filename('fil.txt')).toBeNull();
    });
});

describe('prepare_media_rename_filename_input', () => {
    test('lägger till .png när nytt namn saknar filändelse', () => {
        expect(prepare_media_rename_filename_input('bild.png', 'cookiebanner_ny')).toBe('cookiebanner_ny.png');
    });

    test('byter bildändelse till .png', () => {
        expect(prepare_media_rename_filename_input('bild.png', 'ny.jpg')).toBe('ny.png');
    });

    test('behåller .png oförändrat', () => {
        expect(prepare_media_rename_filename_input('bild.png', 'ny.png')).toBe('ny.png');
    });

    test('lämnar video utan automatisk .png', () => {
        expect(prepare_media_rename_filename_input('klipp.mp4', 'nytt')).toBe('nytt');
    });
});

describe('resolve_media_rename_filename', () => {
    test('normaliserar bild till .png', () => {
        const result = resolve_media_rename_filename('gammal.png', 'ny.jpg', new Set(['gammal.png']));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.requested_filename).toBe('ny.png');
        expect(result.filename).toBe('ny.png');
        expect(result.unchanged).toBe(false);
    });

    test('markerar oförändrat namn', () => {
        const result = resolve_media_rename_filename('bild.png', 'bild.png', new Set(['bild.png']));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.unchanged).toBe(true);
        expect(result.filename).toBe('bild.png');
    });

    test('ger suffix vid krock med annan fil', () => {
        const existing = new Set(['bild.png', 'annan.png']);
        const result = resolve_media_rename_filename('annan.png', 'bild.png', existing);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.filename).toBe('bild (2).png');
        expect(result.renamed_due_to_conflict).toBe(true);
    });

    test('avvisar ogiltigt filnamn', () => {
        const result = resolve_media_rename_filename('bild.png', '..', new Set(['bild.png']));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe('Ogiltigt filnamn');
    });

    test('avvisar filtyp som inte stöds', () => {
        const result = resolve_media_rename_filename('bild.png', 'dokument.pdf', new Set(['bild.png']));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe('Filtypen stöds inte');
    });
});
