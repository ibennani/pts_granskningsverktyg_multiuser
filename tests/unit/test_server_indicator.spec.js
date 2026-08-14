import {
    format_test_server_banner_text,
    apply_test_server_viewport_indicator,
    apply_test_server_document_title_prefix,
    update_test_server_banner_text
} from '../../js/logic/test_server_indicator.ts';

describe('test_server_indicator', () => {
    afterEach(() => {
        document.documentElement.classList.remove('test-server-viewport');
        const banner = document.getElementById('test-server-banner');
        if (banner) banner.remove();
        window.history.pushState({}, '', '/');
        delete window.BUILD_INFO;
    });

    test('format_test_server_banner_text innehåller etikett och tid', () => {
        const text = format_test_server_banner_text('2026-06-24T10:30:00.000Z');
        expect(text).toMatch(/^Testserver Leffe: Byggt .+ kl \d{2}:\d{2}$/);
    });

    test('apply_test_server_viewport_indicator sätter klass och banner i dokumentflöde', () => {
        window.history.pushState({}, '', '/test-server/');
        window.BUILD_INFO = { timestamp: '2026-06-24T10:30:00.000Z' };

        apply_test_server_viewport_indicator();

        expect(document.documentElement.classList.contains('test-server-viewport')).toBe(true);
        const banner = document.getElementById('test-server-banner');
        expect(banner).not.toBeNull();
        expect(banner.getAttribute('role')).toBe('status');
        expect(banner.className).toBe('test-server-banner');
        expect(window.getComputedStyle(banner).position).not.toBe('fixed');
        expect(banner).toBe(document.body.firstElementChild);
        expect(banner.textContent).toContain('Testserver Leffe: Byggt');
    });

    test('update_test_server_banner_text uppdaterar befintlig banner', () => {
        window.history.pushState({}, '', '/test-server/');
        apply_test_server_viewport_indicator();
        window.BUILD_INFO = { timestamp: '2026-06-24T14:15:00.000Z' };
        update_test_server_banner_text();
        const banner = document.getElementById('test-server-banner');
        expect(banner.textContent).toContain('Testserver Leffe: Byggt');
    });

    test('ingen markör utanför test-server-path', () => {
        window.history.pushState({}, '', '/v2/');
        apply_test_server_viewport_indicator();
        expect(document.getElementById('test-server-banner')).toBeNull();
        expect(document.documentElement.classList.contains('test-server-viewport')).toBe(false);
    });

    test('apply_test_server_document_title_prefix på test-server', () => {
        window.history.pushState({}, '', '/test-server/');
        expect(apply_test_server_document_title_prefix('Alla granskningar | Digital tillsyn')).toBe(
            'Testserver Leffe: Alla granskningar | Digital tillsyn'
        );
    });

    test('apply_test_server_document_title_prefix utanför test-server', () => {
        window.history.pushState({}, '', '/v2/');
        expect(apply_test_server_document_title_prefix('Alla granskningar | Digital tillsyn')).toBe(
            'Alla granskningar | Digital tillsyn'
        );
    });
});
