import { build_save_button_html_content } from '../../js/ui/save_button_html.js';

describe('build_save_button_html_content', () => {
    test('renderar etikett före diskett-ikon dold för skärmlysare', () => {
        const html = build_save_button_html_content('Spara ändringar');
        expect(html).toMatch(/^<span>Spara ändringar<\/span><span aria-hidden="true">/);
        expect(html).toContain('<svg');
        expect(html.endsWith('</span>')).toBe(true);
    });

    test('escapar HTML i etiketten', () => {
        const html = build_save_button_html_content('Spara & stäng');
        expect(html).toContain('<span>Spara &amp; stäng</span>');
    });
});
