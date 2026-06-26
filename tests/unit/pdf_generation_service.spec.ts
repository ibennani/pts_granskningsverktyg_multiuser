/**
 * @fileoverview Enhetstester för PDF-tjänsten (mockad Puppeteer).
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const print_to_pdf_mock = jest.fn(async () => ({
    data: Buffer.from('%PDF-1.4').toString('base64'),
}));
const set_content_mock = jest.fn(async () => undefined);
const emulate_media_type_mock = jest.fn(async () => undefined);
const close_mock = jest.fn(async () => undefined);

jest.unstable_mockModule('puppeteer', () => ({
    default: {
        launch: jest.fn(async () => ({
            newPage: jest.fn(async () => ({
                setContent: set_content_mock,
                setDefaultNavigationTimeout: jest.fn(),
                setDefaultTimeout: jest.fn(),
                emulateMediaType: emulate_media_type_mock,
                createCDPSession: jest.fn(async () => ({
                    send: print_to_pdf_mock,
                })),
            })),
            close: close_mock,
        })),
    },
}));

const { generate_pdf_from_html } = await import('../../server/services/pdf_generation_service.ts');

describe('pdf_generation_service', () => {
    beforeEach(() => {
        print_to_pdf_mock.mockClear();
        set_content_mock.mockClear();
        emulate_media_type_mock.mockClear();
        close_mock.mockClear();
    });

    test('anropar Page.printToPDF med taggad PDF och bokmärken', async () => {
        const html = '<!DOCTYPE html><html lang="sv"><body><h1>Test</h1></body></html>';
        const buffer = await generate_pdf_from_html({ htmlContent: html });

        expect(set_content_mock).toHaveBeenCalledWith(html, {
            waitUntil: 'load',
            timeout: 120_000,
        });
        expect(emulate_media_type_mock).toHaveBeenCalledWith('print');
        expect(print_to_pdf_mock).toHaveBeenCalledWith(
            'Page.printToPDF',
            expect.objectContaining({
                generateTaggedPDF: true,
                generateDocumentOutline: true,
                printBackground: true,
            })
        );
        expect(close_mock).toHaveBeenCalled();
        expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    });
});
