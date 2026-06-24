import {
    DEFAULT_DEPLOY_BASE_PREFIX,
    TEST_SERVER_BASE_PREFIX,
    detect_base_prefix_from_pathname,
    get_api_base_path,
    get_deploy_base_prefix,
    get_ws_base_path,
    is_test_server_instance,
    normalize_deploy_base_path
} from '../../js/utils/app_base_path.ts';

describe('app_base_path', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    test('normalize_deploy_base_path lägger till avslutande slash', () => {
        expect(normalize_deploy_base_path('/v2')).toBe('/v2/');
        expect(normalize_deploy_base_path('/test-server/')).toBe('/test-server/');
        expect(normalize_deploy_base_path('/')).toBe('/');
    });

    test('detect_base_prefix_from_pathname känner igen v2 och test-server', () => {
        expect(detect_base_prefix_from_pathname('/v2')).toBe(DEFAULT_DEPLOY_BASE_PREFIX);
        expect(detect_base_prefix_from_pathname('/v2/foo')).toBe(DEFAULT_DEPLOY_BASE_PREFIX);
        expect(detect_base_prefix_from_pathname('/test-server')).toBe(TEST_SERVER_BASE_PREFIX);
        expect(detect_base_prefix_from_pathname('/test-server/')).toBe(TEST_SERVER_BASE_PREFIX);
        expect(detect_base_prefix_from_pathname('/')).toBe('');
    });

    test('get_api_base_path och get_ws_base_path följer Vite BASE_URL', () => {
        expect(get_api_base_path()).toBe('/v2/api');
        expect(get_ws_base_path()).toBe('/v2/ws');
        expect(get_deploy_base_prefix()).toBe('/v2');
    });

    test('is_test_server_instance via pathname', () => {
        window.history.pushState({}, '', '/test-server/');
        expect(is_test_server_instance()).toBe(true);

        window.history.pushState({}, '', '/v2/');
        expect(is_test_server_instance()).toBe(false);
    });
});
