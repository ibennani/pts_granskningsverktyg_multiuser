/**
 * @fileoverview Enhetstester för fullsidsskärmdump (mockad Puppeteer).
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const set_viewport_mock = jest.fn(async () => undefined);
const goto_mock = jest.fn(async () => ({ status: () => 200 }));
const evaluate_mock = jest.fn(async () => undefined);
const title_mock = jest.fn(async () => 'Testtitel');
const screenshot_mock = jest.fn(async () => Buffer.from('png-bytes'));
const close_mock = jest.fn(async () => undefined);

jest.unstable_mockModule('puppeteer', () => ({
    default: {
        launch: jest.fn(async () => ({
            newPage: jest.fn(async () => ({
                setViewport: set_viewport_mock,
                goto: goto_mock,
                evaluate: evaluate_mock,
                title: title_mock,
                screenshot: screenshot_mock,
            })),
            close: close_mock,
        })),
    },
}));

const { capture_page_screenshot } = await import('../../server/services/page_screenshot_service.ts');

describe('page_screenshot_service', () => {
    beforeEach(() => {
        set_viewport_mock.mockClear();
        goto_mock.mockClear();
        evaluate_mock.mockClear();
        title_mock.mockClear();
        screenshot_mock.mockClear();
        close_mock.mockClear();
    });

    test('sätter viewport med deviceScaleFactor 2', async () => {
        await capture_page_screenshot({ url: 'https://example.com' });
        expect(set_viewport_mock).toHaveBeenCalledWith({
            width: 1280,
            height: 800,
            deviceScaleFactor: 2,
        });
    });

    test('tar fullPage-screenshot och stänger webbläsaren', async () => {
        const result = await capture_page_screenshot({ url: 'https://example.com' });
        expect(goto_mock).toHaveBeenCalledWith(
            'https://example.com',
            expect.objectContaining({ waitUntil: 'networkidle2' })
        );
        expect(screenshot_mock).toHaveBeenCalledWith({ type: 'png', fullPage: true });
        expect(result.page_title).toBe('Testtitel');
        expect(result.png_buffer.toString()).toBe('png-bytes');
        expect(close_mock).toHaveBeenCalled();
    });

    test('autoScroll och scroll-to-top körs via evaluate', async () => {
        await capture_page_screenshot({ url: 'https://example.com' });
        expect(evaluate_mock).toHaveBeenCalledTimes(2);
    });
});
