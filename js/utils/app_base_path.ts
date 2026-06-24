/**
 * Gemensam bas-sökväg för deploy under /v2/, /test-server/ m.m.
 * @module js/utils/app_base_path
 */

/** Känd testserver-prefix (utan avslutande slash). */
export const TEST_SERVER_BASE_PREFIX = '/test-server';

/** Standard prod-prefix (utan avslutande slash). */
export const DEFAULT_DEPLOY_BASE_PREFIX = '/v2';

/**
 * Normaliserar bas-sökväg till formen "/prefix/" eller "/" vid rot.
 */
export function normalize_deploy_base_path(raw: string | undefined | null): string {
    if (!raw || raw === '/') return '/';
    const trimmed = String(raw).replace(/\/+$/, '') || '/';
    if (trimmed === '/') return '/';
    return `${trimmed}/`;
}

/**
 * Returnerar Vite BASE_URL (build-time) som normaliserad bas-sökväg.
 */
export function get_deploy_base_path(): string {
    if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
        return normalize_deploy_base_path(import.meta.env.BASE_URL);
    }
    return normalize_deploy_base_path(DEFAULT_DEPLOY_BASE_PREFIX);
}

/**
 * Prefix utan avslutande slash, t.ex. "/v2" eller "/test-server".
 */
export function get_deploy_base_prefix(): string {
    const base = get_deploy_base_path();
    if (base === '/') return '';
    return base.replace(/\/$/, '');
}

/**
 * API-bas, t.ex. "/v2/api" eller "/test-server/api".
 */
export function get_api_base_path(): string {
    const base = get_deploy_base_path();
    if (base === '/') return '/api';
    return `${base.replace(/\/$/, '')}/api`;
}

/**
 * WebSocket-sökväg relativt host, t.ex. "/v2/ws".
 */
export function get_ws_base_path(): string {
    const base = get_deploy_base_path();
    if (base === '/') return '/ws';
    return `${base.replace(/\/$/, '')}/ws`;
}

/**
 * Detekterar bas-prefix från pathname (fallback när BASE_URL saknas).
 */
export function detect_base_prefix_from_pathname(pathname: string | undefined | null): string {
    const path = (pathname || '/').split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
    if (path === TEST_SERVER_BASE_PREFIX || path.startsWith(`${TEST_SERVER_BASE_PREFIX}/`)) {
        return TEST_SERVER_BASE_PREFIX;
    }
    if (path === DEFAULT_DEPLOY_BASE_PREFIX || path.startsWith(`${DEFAULT_DEPLOY_BASE_PREFIX}/`)) {
        return DEFAULT_DEPLOY_BASE_PREFIX;
    }
    return '';
}

/**
 * True när appen körs under /test-server/ (build eller pathname).
 */
export function is_test_server_instance(): boolean {
    const build_prefix = get_deploy_base_prefix();
    if (build_prefix === TEST_SERVER_BASE_PREFIX) return true;
    if (typeof window !== 'undefined' && window.location) {
        return detect_base_prefix_from_pathname(window.location.pathname) === TEST_SERVER_BASE_PREFIX;
    }
    return false;
}
