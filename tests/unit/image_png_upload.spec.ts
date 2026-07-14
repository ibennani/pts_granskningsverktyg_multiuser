import { describe, test, expect } from '@jest/globals';
import {
    is_upload_image_file,
    is_upload_video_file,
    should_convert_image_to_png,
    normalize_image_filename_to_png
} from '../../shared/media/image_png_upload.js';

describe('image_png_upload', () => {
    test('identifierar bilder och videor', () => {
        expect(is_upload_image_file('image/jpeg', 'foto.jpg')).toBe(true);
        expect(is_upload_image_file('', 'foto.heic')).toBe(true);
        expect(is_upload_video_file('video/mp4', 'film.mp4')).toBe(true);
        expect(is_upload_image_file('video/mp4', 'film.mp4')).toBe(false);
    });

    test('normalize_image_filename_to_png byter bildändelse', () => {
        expect(normalize_image_filename_to_png('skarm.jpg')).toBe('skarm.png');
        expect(normalize_image_filename_to_png('skarm.png')).toBe('skarm.png');
        expect(normalize_image_filename_to_png('film.mp4')).toBe('film.mp4');
    });

    test('should_convert_image_to_png hoppar över redan PNG', () => {
        expect(should_convert_image_to_png('image/jpeg', 'foto.jpg')).toBe(true);
        expect(should_convert_image_to_png('image/png', 'foto.png')).toBe(false);
        expect(should_convert_image_to_png('video/mp4', 'film.mp4')).toBe(false);
    });
});
