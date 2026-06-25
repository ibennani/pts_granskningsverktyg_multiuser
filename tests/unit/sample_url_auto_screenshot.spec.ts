/**
 * @fileoverview Enhetstester för auto-skärmdumpslogik i stickprovsformuläret.
 */
import { describe, test, expect } from '@jest/globals';
import {
    normalize_url_for_screenshot,
    remove_filename_from_list,
    replace_auto_screenshot_filename,
    should_skip_url_screenshot_capture,
    should_skip_url_screenshot_when_attached_media_exists,
    sync_sample_auto_screenshot_state_from_data,
    on_sample_attach_media_saved
} from '../../js/components/add_sample_form/sample_url_auto_screenshot_logic.ts';

describe('sample_url_auto_screenshot', () => {
    test('normalize_url_for_screenshot lägger till protokoll', () => {
        expect(normalize_url_for_screenshot('example.com', (u) => `https://${u}`)).toBe('https://example.com');
    });

    test('remove_filename_from_list tar bort angivet filnamn', () => {
        expect(remove_filename_from_list(['a.png', 'b.png'], 'a.png')).toEqual(['b.png']);
    });

    test('replace_auto_screenshot_filename byter auto-fil', () => {
        expect(replace_auto_screenshot_filename(['gammal.png', 'manuell.png'], 'gammal.png', 'ny.png')).toEqual([
            'manuell.png',
            'ny.png'
        ]);
    });

    test('should_skip_url_screenshot_capture är true vid oförändrad URL och bifogad auto-fil', () => {
        expect(
            should_skip_url_screenshot_capture(
                'https://example.com',
                'https://example.com',
                'bild.png',
                ['bild.png']
            )
        ).toBe(true);
    });

    test('should_skip_url_screenshot_capture är false vid oförändrad URL utan bifogad auto-fil', () => {
        expect(
            should_skip_url_screenshot_capture('https://example.com', 'https://example.com', 'bild.png', [])
        ).toBe(false);
    });

    test('should_skip_url_screenshot_capture är false vid ny URL', () => {
        expect(
            should_skip_url_screenshot_capture(
                'https://example.com/ny',
                'https://example.com',
                'bild.png',
                ['bild.png']
            )
        ).toBe(false);
    });

    test('should_skip_url_screenshot_when_attached_media_exists ignorerar enbart auto-skärmdump', () => {
        expect(should_skip_url_screenshot_when_attached_media_exists([])).toBe(false);
        expect(should_skip_url_screenshot_when_attached_media_exists(['auto.png'], 'auto.png')).toBe(false);
        expect(should_skip_url_screenshot_when_attached_media_exists(['manuell.png'])).toBe(true);
        expect(should_skip_url_screenshot_when_attached_media_exists(['auto.png', 'manuell.png'], 'auto.png')).toBe(
            true
        );
    });

    test('sync_sample_auto_screenshot_state_from_data läser auto-filnamn', () => {
        const component = {
            url_auto_screenshot_filename: null,
            url_auto_screenshot_source_url: null
        };
        sync_sample_auto_screenshot_state_from_data(component, {
            url: 'https://example.com',
            urlAutoScreenshotFilename: 'Startsida_skärmavbild.png',
            attachedMediaFilenames: ['Startsida_skärmavbild.png']
        });
        expect(component.url_auto_screenshot_filename).toBe('Startsida_skärmavbild.png');
        expect(component.url_auto_screenshot_source_url).toBe('https://example.com');
    });

    test('sync_sample_auto_screenshot_state_from_data rensar föråldrad auto-referens utan bifogad fil', () => {
        const component = {
            url_auto_screenshot_filename: 'gammal.png',
            url_auto_screenshot_source_url: 'https://example.com'
        };
        sync_sample_auto_screenshot_state_from_data(component, {
            url: 'https://example.com',
            urlAutoScreenshotFilename: 'gammal.png',
            attachedMediaFilenames: []
        });
        expect(component.url_auto_screenshot_filename).toBeNull();
        expect(component.url_auto_screenshot_source_url).toBeNull();
    });

    test('on_sample_attach_media_saved rensar auto-referens när fil tas bort manuellt', () => {
        let filename: string | null = 'auto.png';
        let source_url: string | null = 'https://example.com';
        on_sample_attach_media_saved(
            {
                get_url_auto_screenshot_filename: () => filename,
                set_url_auto_screenshot_tracking: (next_filename, next_source_url) => {
                    filename = next_filename;
                    source_url = next_source_url;
                }
            },
            []
        );
        expect(filename).toBeNull();
        expect(source_url).toBeNull();
    });
});
