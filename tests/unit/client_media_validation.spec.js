/**
 * @fileoverview Enhetstester för klientvalidering av mediefiler.
 */

import {
    build_media_file_input_accept_attribute,
    format_allowed_media_types_label,
    is_allowed_client_media_file
} from '../../shared/media/client_media_validation.js';

describe('is_allowed_client_media_file', () => {
    test('godkänner png via mime', () => {
        expect(is_allowed_client_media_file({ type: 'image/png', name: 'a.png' } as File)).toBe(true);
    });

    test('godkänner mp4 via mime', () => {
        expect(is_allowed_client_media_file({ type: 'video/mp4', name: 'clip.mp4' } as File)).toBe(true);
    });

    test('godkänner heic via filändelse när mime saknas', () => {
        expect(is_allowed_client_media_file({ type: '', name: 'foto.heic' } as File)).toBe(true);
    });

    test('avvisar pdf', () => {
        expect(is_allowed_client_media_file({ type: 'application/pdf', name: 'rapport.pdf' } as File)).toBe(false);
    });

    test('avvisar svg trots image/svg+xml', () => {
        expect(is_allowed_client_media_file({ type: 'image/svg+xml', name: 'icon.svg' } as File)).toBe(false);
    });

    test('avvisar mov', () => {
        expect(is_allowed_client_media_file({ type: 'video/quicktime', name: 'film.mov' } as File)).toBe(false);
    });
});

describe('client media helpers', () => {
    test('accept-attribut listar explicita typer', () => {
        const accept = build_media_file_input_accept_attribute();
        expect(accept).toContain('image/png');
        expect(accept).not.toContain('image/*');
    });

    test('format_allowed_media_types_label är icke-tom', () => {
        expect(format_allowed_media_types_label().length).toBeGreaterThan(5);
    });
});
