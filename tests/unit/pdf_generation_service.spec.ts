/**
 * @fileoverview Enhetstester för PDF-tjänsten (mockad Puppeteer).
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const pdf_mock = jest.fn(async () => new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]));
const set_content_mock = jest.fn(async () => undefined);
const close_mock = jest.fn(async () => undefined);

jest.unstable_mockModule('puppeteer', () => ({
    default: {
        launch: jest.fn(async () => ({
            newPage: jest.fn(async () => ({
                setContent: set_content_mock,
                pdf: pdf_mock,
            })),
            close: close_mock,
        })),
    },
}));

const { generate_pdf_from_html } = await import('../../server/services/pdf_generation_service.ts');

describe('pdf_generation_service', () => {
    beforeEach(() => {
        pdf_mock.mockClear();
        set_content_mock.mockClear();
        close_mock.mockClear();
    });

    test('anropar page.pdf med tagged true och returnerar Buffer', async () => {
        const html = '<!DOCTYPE html><html lang="sv"><body><h1>Test</h1></body></html>';
        const buffer = await generate_pdf_from_html({ htmlContent: html });

        expect(set_content_mock).toHaveBeenCalledWith(html, { waitUntil: 'networkidle0' });
        expect(pdf_mock).toHaveBeenCalledWith(
            expect.objectContaining({
                format: 'A4',
                printBackground: true,
                tagged: true,
            })
        );
        expect(close_mock).toHaveBeenCalled();
        expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    });
});
