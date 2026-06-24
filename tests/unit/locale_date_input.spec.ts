import {
    get_locale_date_format_example,
    format_iso_for_locale_date_input,
    parse_locale_date_text_to_iso_date,
    normalize_locale_date_text_display
} from '../../js/utils/locale_date_input.js';

describe('locale_date_input', () => {
    test('parse sv-SE med punkt som avskiljare', () => {
        const result = parse_locale_date_text_to_iso_date('15.06.2024', 'sv-SE');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.iso_date).toBe('2024-06-15T00:00:00.000Z');
        }
    });

    test('parse ISO-liknande med bindestreck', () => {
        const result = parse_locale_date_text_to_iso_date('2024-06-15', 'sv-SE');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.iso_date).toBe('2024-06-15T00:00:00.000Z');
        }
    });

    test('parse en-GB med snedstreck (dag före månad)', () => {
        const result = parse_locale_date_text_to_iso_date('15/06/2024', 'en-GB');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.iso_date).toBe('2024-06-15T00:00:00.000Z');
        }
    });

    test('tom sträng ger empty', () => {
        expect(parse_locale_date_text_to_iso_date('   ', 'sv-SE')).toEqual({ ok: false, reason: 'empty' });
    });

    test('ogiltigt datum avvisas', () => {
        expect(parse_locale_date_text_to_iso_date('32.13.2024', 'sv-SE')).toEqual({ ok: false, reason: 'invalid' });
    });

    test('format och normalisering rundtur', () => {
        const iso = '2024-06-15T00:00:00.000Z';
        const displayed = format_iso_for_locale_date_input(iso, 'sv-SE');
        expect(displayed).toBeTruthy();
        const reparsed = parse_locale_date_text_to_iso_date(displayed, 'sv-SE');
        expect(reparsed.ok).toBe(true);
        if (reparsed.ok) {
            expect(reparsed.iso_date).toBe(iso);
        }
    });

    test('normalize_locale_date_text_display formaterar giltig inmatning', () => {
        const normalized = normalize_locale_date_text_display('15/06/2024', 'sv-SE');
        const parsed = parse_locale_date_text_to_iso_date(normalized, 'sv-SE');
        expect(parsed.ok).toBe(true);
    });

    test('get_locale_date_format_example returnerar icke-tom sträng', () => {
        expect(get_locale_date_format_example('sv-SE').length).toBeGreaterThan(0);
    });
});
