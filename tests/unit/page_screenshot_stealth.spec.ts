/**
 * @fileoverview Enhetstester för stealth/status-hantering vid skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import { assert_acceptable_navigation_status } from '../../server/services/page_screenshot_stealth.ts';

describe('page_screenshot_stealth', () => {
    test('accept_acceptable_navigation_status tillåter 2xx', () => {
        expect(() => assert_acceptable_navigation_status(200, false)).not.toThrow();
    });

    test('assert_acceptable_navigation_status tillåter 403 med innehåll', () => {
        expect(() => assert_acceptable_navigation_status(403, true)).not.toThrow();
    });

    test('assert_acceptable_navigation_status kastar vid 403 utan innehåll', () => {
        expect(() => assert_acceptable_navigation_status(403, false)).toThrow('HTTP 403');
    });

    test('assert_acceptable_navigation_status kastar vid 500', () => {
        expect(() => assert_acceptable_navigation_status(500, true)).toThrow('HTTP 500');
    });
});
