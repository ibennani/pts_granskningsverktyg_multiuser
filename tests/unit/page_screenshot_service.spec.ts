/**
 * @fileoverview Enhetstester för skärmavbild med höjdbegränsning (mockad Puppeteer).
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { browser_read_document_scroll_height } from '../../server/services/page_screenshot_browser_scripts_loader.js';

const set_user_agent_mock = jest.fn(async () => undefined);
const set_extra_http_headers_mock = jest.fn(async () => undefined);
const evaluate_on_new_document_mock = jest.fn(async () => undefined);
const set_viewport_mock = jest.fn(async () => undefined);
const goto_mock = jest.fn(async () => ({ status: () => 200 }));
const evaluate_mock = jest.fn(async () => undefined);
const title_mock = jest.fn(async () => 'Testtitel');
const screenshot_mock = jest.fn(async () => Buffer.from('png-bytes'));
const wait_for_network_idle_mock = jest.fn(async () => undefined);
const close_mock = jest.fn(async () => undefined);

jest.unstable_mockModule('puppeteer', () => ({
    default: {
        launch: jest.fn(async () => ({
            newPage: jest.fn(async () => ({
                setUserAgent: set_user_agent_mock,
                setExtraHTTPHeaders: set_extra_http_headers_mock,
                evaluateOnNewDocument: evaluate_on_new_document_mock,
                setViewport: set_viewport_mock,
                goto: goto_mock,
                evaluate: evaluate_mock,
                title: title_mock,
                screenshot: screenshot_mock,
                waitForNetworkIdle: wait_for_network_idle_mock,
            })),
            close: close_mock,
        })),
    },
}));

const { capture_page_screenshot } = await import('../../server/services/page_screenshot_service.ts');

function mock_evaluate_with_scroll_height(scroll_height: number) {
    evaluate_mock.mockImplementation(async (fn: unknown) => {
        if (fn === browser_read_document_scroll_height) {
            return scroll_height;
        }
        return undefined;
    });
}

describe('page_screenshot_service', () => {
    beforeEach(() => {
        set_user_agent_mock.mockClear();
        set_extra_http_headers_mock.mockClear();
        evaluate_on_new_document_mock.mockClear();
        set_viewport_mock.mockClear();
        goto_mock.mockClear();
        evaluate_mock.mockClear();
        title_mock.mockClear();
        screenshot_mock.mockClear();
        wait_for_network_idle_mock.mockClear();
        close_mock.mockClear();
        mock_evaluate_with_scroll_height(2000);
    });

    test('konfigurerar stealth (user agent m.m.)', async () => {
        await capture_page_screenshot({ url: 'https://example.com' });
        expect(set_user_agent_mock).toHaveBeenCalled();
        expect(set_extra_http_headers_mock).toHaveBeenCalled();
        expect(evaluate_on_new_document_mock).toHaveBeenCalled();
    });

    test('sätter viewport till dokumenthöjd före screenshot', async () => {
        await capture_page_screenshot({ url: 'https://example.com' });
        expect(set_viewport_mock).toHaveBeenCalledWith({
            width: 1280,
            height: 800,
            deviceScaleFactor: 2,
        });
        expect(set_viewport_mock).toHaveBeenLastCalledWith({
            width: 1280,
            height: 2000,
            deviceScaleFactor: 2,
        });
    });

    test('tar viewport-screenshot med dokumenthöjd och stänger webbläsaren', async () => {
        const result = await capture_page_screenshot({ url: 'https://example.com' });
        expect(goto_mock).toHaveBeenCalledWith(
            'https://example.com',
            expect.objectContaining({ waitUntil: 'load' })
        );
        expect(screenshot_mock).toHaveBeenCalledWith({
            type: 'png',
            fullPage: false,
        });
        expect(result.page_title).toBe('Testtitel');
        expect(result.png_buffer.toString()).toBe('png-bytes');
        expect(close_mock).toHaveBeenCalled();
    });

    test('begränsar capture-höjd till tre gånger viewport-bredden', async () => {
        mock_evaluate_with_scroll_height(8000);

        await capture_page_screenshot({ url: 'https://example.com' });

        expect(set_viewport_mock).toHaveBeenLastCalledWith({
            width: 1280,
            height: 3840,
            deviceScaleFactor: 2,
        });
        expect(screenshot_mock).toHaveBeenCalledWith({
            type: 'png',
            fullPage: false,
        });
    });

    test('kör lazy-scroll, bildväntan och scroll-to-top via evaluate', async () => {
        await capture_page_screenshot({ url: 'https://example.com' });
        expect(evaluate_mock.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(wait_for_network_idle_mock).toHaveBeenCalled();
    });

    test('tillåter 403 om sidan ändå har renderat innehåll', async () => {
        goto_mock.mockResolvedValueOnce({ status: () => 403 });
        evaluate_mock.mockImplementation(async (fn: unknown) => {
            if (fn === browser_read_document_scroll_height) {
                return 2000;
            }
            return true;
        });

        const result = await capture_page_screenshot({ url: 'https://example.com' });
        expect(result.page_title).toBe('Testtitel');
        expect(screenshot_mock).toHaveBeenCalled();
    });

    test('kastar vid 403 utan renderbart innehåll', async () => {
        goto_mock.mockResolvedValueOnce({ status: () => 403 });
        evaluate_mock.mockResolvedValueOnce(false);

        await expect(capture_page_screenshot({ url: 'https://example.com' })).rejects.toThrow('HTTP 403');
    });
});
