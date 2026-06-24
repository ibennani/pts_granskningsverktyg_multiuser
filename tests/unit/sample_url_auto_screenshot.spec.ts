/**
 * @fileoverview Enhetstester för auto-skärmdumpslogik i stickprovsformuläret.
 */
import { describe, test, expect } from '@jest/globals';
import {
    normalize_url_for_screenshot,
    remove_filename_from_list,
    replace_auto_screenshot_filename,
    should_skip_url_screenshot_capture,
    sync_sample_auto_screenshot_state_from_data
} from '../../js/components/add_sample_form/sample_url_auto_screenshot.ts';

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

    test('should_skip_url_screenshot_capture är true vid oförändrad URL', () => {
        expect(
            should_skip_url_screenshot_capture('https://example.com', 'https://example.com', 'bild.png')
        ).toBe(true);
    });

    test('should_skip_url_screenshot_capture är false vid ny URL', () => {
        expect(
            should_skip_url_screenshot_capture('https://example.com/ny', 'https://example.com', 'bild.png')
        ).toBe(false);
    });

    test('sync_sample_auto_screenshot_state_from_data läser auto-filnamn', () => {
        const component = {
            url_auto_screenshot_filename: null,
            url_auto_screenshot_source_url: null
        };
        sync_sample_auto_screenshot_state_from_data(component, {
            url: 'https://example.com',
            urlAutoScreenshotFilename: 'Startsida_skärmavbild.png'
        });
        expect(component.url_auto_screenshot_filename).toBe('Startsida_skärmavbild.png');
        expect(component.url_auto_screenshot_source_url).toBe('https://example.com');
    });
});
