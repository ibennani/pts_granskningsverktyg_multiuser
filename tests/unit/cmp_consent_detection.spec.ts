/**
 * @fileoverview Enhetstester för CMP consent-detektering och ren observationsnavigation.
 */
import { describe, test, expect } from '@jest/globals';
import {
    get_all_banner_container_selectors,
    build_cmp_consent_detection_eval_source,
} from '../../server/services/cmp/cmp_consent_detection.ts';
import { CMP_VENDORS } from '../../server/services/cmp/cmp_vendors/registry.ts';

describe('cmp_consent_detection', () => {
    test('get_all_banner_container_selectors inkluderar vendor och generiska selectors', () => {
        const selectors = get_all_banner_container_selectors();
        expect(selectors.length).toBeGreaterThan(10);
        const cookiebot = CMP_VENDORS.find((v) => v.id === 'cookiebot');
        expect(selectors).toContain(cookiebot?.banner_container_selectors?.[0]);
        expect(selectors.some((s) => s.includes('consent'))).toBe(true);
    });

    test('build_cmp_consent_detection_eval_source returnerar körbar JS', () => {
        const source = build_cmp_consent_detection_eval_source();
        expect(source).toContain('vendorRules');
        expect(() => {
            // eslint-disable-next-line no-new-func
            new Function(`return ${source}`)();
        }).not.toThrow();
    });
});

describe('navigate_for_clean_consent_observation', () => {
    test('navigate_for_initial_consent_observation exporteras som alias utan CMP-block', async () => {
        const { navigate_for_initial_consent_observation } = await import(
            '../../server/services/page_capture_session.ts'
        );
        expect(typeof navigate_for_initial_consent_observation).toBe('function');
    });
});
