/**
 * @fileoverview Enhetstester för skärmavbild med höjdbegränsning (mockad Puppeteer).
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { browser_read_document_scroll_height } from '../../server/services/page_screenshot_browser_scripts_loader.js';

const set_user_agent_mock = jest.fn(async () => undefined);
const set_extra_http_headers_mock = jest.fn(async () => undefined);
const evaluate_on_new_document_mock = jest.fn(async () => undefined);
const set_viewport_mock = jest.fn(async () => undefined);
const set_request_interception_mock = jest.fn(async () => undefined);
const set_cookie_mock = jest.fn(async () => undefined);
const on_mock = jest.fn();
const goto_mock = jest.fn(async () => ({ status: () => 200 }));
const evaluate_mock = jest.fn(async () => undefined);
const title_mock = jest.fn(async () => 'Testtitel');
const screenshot_mock = jest.fn(async () => Buffer.from('png-bytes'));
const wait_for_network_idle_mock = jest.fn(async () => undefined);
const close_mock = jest.fn(async () => undefined);

const enable_cmp_block_mock = jest.fn(async () => undefined);
const read_cmp_blocked_count_mock = jest.fn(() => 0);
const load_consent_mock = jest.fn(async () => null);
const apply_consent_cookies_mock = jest.fn(async () => false);
const apply_consent_local_storage_mock = jest.fn(async () => false);
const learn_consent_mock = jest.fn(async () => undefined);
const dismiss_cookie_mock = jest.fn(async () => ({
    clicked: false,
    banner_gone: true,
    matched_selector: null,
}));
const hide_cookie_mock = jest.fn(async () => 0);
const is_banner_visible_mock = jest.fn(async () => false);
const settle_consent_mock = jest.fn(async () => undefined);

jest.unstable_mockModule('../../server/services/page_screenshot_cmp_block.js', () => ({
    enable_cmp_request_block_for_screenshot: enable_cmp_block_mock,
    read_cmp_blocked_count: read_cmp_blocked_count_mock,
}));

jest.unstable_mockModule('../../server/services/page_screenshot_consent_cache.js', () => ({
    load_consent_for_domain: load_consent_mock,
    apply_consent_cookies: apply_consent_cookies_mock,
    apply_consent_local_storage: apply_consent_local_storage_mock,
    learn_consent_from_page: learn_consent_mock,
}));

jest.unstable_mockModule('../../server/services/page_screenshot_cookie_consent.js', () => ({
    dismiss_cookie_banners_before_screenshot: dismiss_cookie_mock,
    hide_cookie_banners_visually_for_screenshot: hide_cookie_mock,
    is_cookie_banner_visible: is_banner_visible_mock,
    settle_after_consent_apply: settle_consent_mock,
}));

const dismiss_intrusive_overlay_mock = jest.fn(async () => ({
    clicked: false,
    overlay_gone: true,
    matched_selector: null,
}));
const hide_intrusive_overlay_mock = jest.fn(async () => 0);
const is_intrusive_overlay_visible_mock = jest.fn(async () => false);

jest.unstable_mockModule('../../server/services/page_screenshot_intrusive_overlay.js', () => ({
    dismiss_intrusive_overlays_before_screenshot: dismiss_intrusive_overlay_mock,
    hide_intrusive_overlays_visually_for_screenshot: hide_intrusive_overlay_mock,
    is_intrusive_overlay_visible: is_intrusive_overlay_visible_mock,
}));

jest.unstable_mockModule('../../server/snapshots/audit_snapshot_config.js', () => ({
    get_snapshot_post_navigation_settle_ms: () => 0,
    get_snapshot_pre_screenshot_intrusive_wait_ms: () => 0,
    get_snapshot_full_page_max_height_css: () => 50_000,
}));

jest.unstable_mockModule('puppeteer', () => ({
    default: {
        launch: jest.fn(async () => ({
            newPage: jest.fn(async () => ({
                setUserAgent: set_user_agent_mock,
                setExtraHTTPHeaders: set_extra_http_headers_mock,
                evaluateOnNewDocument: evaluate_on_new_document_mock,
                setViewport: set_viewport_mock,
                setRequestInterception: set_request_interception_mock,
                setCookie: set_cookie_mock,
                on: on_mock,
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

const { capture_page_screenshot, fetch_page_title_from_url } = await import(
    '../../server/services/page_screenshot_service.ts'
);

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
        set_request_interception_mock.mockClear();
        set_cookie_mock.mockClear();
        on_mock.mockClear();
        goto_mock.mockClear();
        evaluate_mock.mockClear();
        title_mock.mockClear();
        screenshot_mock.mockClear();
        wait_for_network_idle_mock.mockClear();
        close_mock.mockClear();
        enable_cmp_block_mock.mockClear();
        read_cmp_blocked_count_mock.mockClear();
        load_consent_mock.mockClear();
        apply_consent_cookies_mock.mockClear();
        apply_consent_local_storage_mock.mockClear();
        learn_consent_mock.mockClear();
        dismiss_cookie_mock.mockClear();
        hide_cookie_mock.mockClear();
        is_banner_visible_mock.mockClear();
        settle_consent_mock.mockClear();
        dismiss_intrusive_overlay_mock.mockClear();
        hide_intrusive_overlay_mock.mockClear();
        is_intrusive_overlay_visible_mock.mockClear();
        mock_evaluate_with_scroll_height(2000);
    });

    test('aktiverar CMP-block och consent-cache endast vid skärmdump', async () => {
        await capture_page_screenshot({ url: 'https://example.com' });
        expect(enable_cmp_block_mock).toHaveBeenCalled();
        expect(load_consent_mock).toHaveBeenCalledWith('https://example.com');
        expect(apply_consent_cookies_mock).toHaveBeenCalled();
        expect(apply_consent_local_storage_mock).toHaveBeenCalled();
        expect(dismiss_cookie_mock).toHaveBeenCalled();
        expect(hide_cookie_mock).toHaveBeenCalled();
        expect(learn_consent_mock).toHaveBeenCalled();
    });

    test('hämtar sidtitel utan CMP-block eller consent-cache', async () => {
        await fetch_page_title_from_url({ url: 'https://example.com' });
        expect(enable_cmp_block_mock).not.toHaveBeenCalled();
        expect(load_consent_mock).not.toHaveBeenCalled();
        expect(apply_consent_cookies_mock).not.toHaveBeenCalled();
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
