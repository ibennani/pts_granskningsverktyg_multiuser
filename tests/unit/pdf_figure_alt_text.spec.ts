/**
 * @fileoverview Enhetstester för /Alt på Figure-taggar i bilaga 3 PDF.
 */
import { describe, test, expect } from '@jest/globals';
import {
    extract_screenshots_appendix_img_alt_texts,
    format_pdf_literal_string,
    upsert_alt_in_struct_dict,
} from '../../shared/pdf/pdf_figure_alt_text.ts';

describe('pdf_figure_alt_text', () => {
    test('extract_screenshots_appendix_img_alt_texts läser alt från bilder i bilaga 3', () => {
        const html =
            '<main class="screenshots-appendix-document">' +
            '<section class="screenshots-appendix">' +
            '<section class="screenshots-appendix__item">' +
            '<img src="data:image/png;base64,AA==" alt="047_1_WEBB_1_2026-04-11_26-11111.png">' +
            '<img src="data:image/png;base64,BB==" alt="048_2_WEBB_1_2026-04-12_26-22222.png">' +
            '</section></section></main>';

        expect(extract_screenshots_appendix_img_alt_texts(html)).toEqual([
            '047_1_WEBB_1_2026-04-11_26-11111.png',
            '048_2_WEBB_1_2026-04-12_26-22222.png',
        ]);
    });

    test('extract_screenshots_appendix_img_alt_texts läser alla alt i separata item-sektioner', () => {
        const html =
            '<main class="screenshots-appendix-document">' +
            '<section class="screenshots-appendix">' +
            '<section class="screenshots-appendix__item">' +
            '<h2 class="screenshots-appendix__heading">047_1_WEBB_1_2026-04-11_26-11111.png</h2>' +
            '<img src="data:image/png;base64,AA==" alt="047_1_WEBB_1_2026-04-11_26-11111.png">' +
            '</section>' +
            '<section class="screenshots-appendix__item">' +
            '<h2 class="screenshots-appendix__heading">048_2_WEBB_1_2026-04-12_26-22222.png</h2>' +
            '<img src="data:image/png;base64,BB==" alt="048_2_WEBB_1_2026-04-12_26-22222.png">' +
            '</section>' +
            '</section></main>';

        expect(extract_screenshots_appendix_img_alt_texts(html)).toEqual([
            '047_1_WEBB_1_2026-04-11_26-11111.png',
            '048_2_WEBB_1_2026-04-12_26-22222.png',
        ]);
    });

    test('extract_screenshots_appendix_img_alt_texts avkodar html-entiteter i alt', () => {
        const html =
            '<main class="screenshots-appendix-document">' +
            '<section class="screenshots-appendix">' +
            '<section class="screenshots-appendix__item">' +
            '<img alt="26-1559_XXL_Sport_&amp;_Vildmark_AB_1.png" src="data:image/png;base64,AA==">' +
            '</section></section></main>';

        expect(extract_screenshots_appendix_img_alt_texts(html)).toEqual([
            '26-1559_XXL_Sport_&_Vildmark_AB_1.png',
        ]);
    });

    test('upsert_alt_in_struct_dict lägger till /Alt enligt PDF-referensen', () => {
        const dict = '<< /Type /StructElem\n/S /Figure\n/P 5 0 R\n/K 42\n>>';
        const updated = upsert_alt_in_struct_dict(dict, '047_1_WEBB_1_2026-04-11_26-11111.png');
        expect(updated).toContain('/Alt (047_1_WEBB_1_2026-04-11_26-11111.png)');
    });

    test('format_pdf_literal_string escapar parenteser', () => {
        expect(format_pdf_literal_string('fil (1).png')).toBe('(fil \\(1\\).png)');
    });
});
