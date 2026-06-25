/**
 * Tester för sample_url_page_title_logic.ts
 */
import {
    sanitize_page_title_for_description,
    should_apply_page_title_to_description
} from '../../js/components/add_sample_form/sample_url_page_title_logic.ts';

describe('sample_url_page_title_logic', () => {
    test('should_apply_page_title_to_description när beskrivning är tom', () => {
        expect(should_apply_page_title_to_description('', '', '')).toBe(true);
    });

    test('should_apply_page_title_to_description när beskrivning matchar tidigare sidtitel', () => {
        expect(should_apply_page_title_to_description('Gammal titel', 'Gammal titel', '')).toBe(true);
    });

    test('should_apply_page_title_to_description när beskrivning matchar tidigare sidtyp', () => {
        expect(should_apply_page_title_to_description('Startsida', '', 'Startsida')).toBe(true);
    });

    test('should_apply_page_title_to_description nekar vid manuell beskrivning', () => {
        expect(should_apply_page_title_to_description('Min egen text', 'Gammal titel', 'Startsida')).toBe(false);
    });

    test('sanitize_page_title_for_description trimmar', () => {
        expect(sanitize_page_title_for_description('  Hej  ')).toBe('Hej');
    });
});
