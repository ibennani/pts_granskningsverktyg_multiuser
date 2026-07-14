/**
 * @fileoverview Enhetstester för CMP-block vid skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import {
    should_block_cmp_request,
    hostname_matches_cmp_block_suffix,
    hostname_matches_cmp_block_prefix,
} from '../../server/services/page_screenshot_cmp_block_logic.ts';

describe('page_screenshot_cmp_block_logic', () => {
    test('should_block_cmp_request blockerar Cookiebot-script', () => {
        expect(
            should_block_cmp_request('https://consent.cookiebot.com/uc.js', 'script')
        ).toBe(true);
    });

    test('should_block_cmp_request blockerar inte document', () => {
        expect(
            should_block_cmp_request('https://www.pts.se/', 'document')
        ).toBe(false);
    });

    test('should_block_cmp_request blockerar inte vanliga script på huvuddomän', () => {
        expect(
            should_block_cmp_request('https://www.pts.se/assets/app.js', 'script')
        ).toBe(false);
    });

    test('hostname_matches_cmp_block_suffix känner igen underdomän', () => {
        expect(hostname_matches_cmp_block_suffix('cdn.cookielaw.org')).toBe(true);
    });

    test('should_block_cmp_request blockerar Schibsted Sourcepoint cmp-subdomän', () => {
        expect(
            should_block_cmp_request('https://cmp.svd.se/unified/wrapperMessagingWithoutDetection.js', 'script')
        ).toBe(true);
    });

    test('should_block_cmp_request blockerar privacy-mgmt', () => {
        expect(
            should_block_cmp_request('https://cdn.privacy-mgmt.com/consent/tcfv2/vendor-list', 'xhr')
        ).toBe(true);
    });

    test('hostname_matches_cmp_block_prefix känner igen cmp.*-värdar', () => {
        expect(hostname_matches_cmp_block_prefix('cmp.svd.se')).toBe(true);
        expect(hostname_matches_cmp_block_prefix('www.svd.se')).toBe(false);
    });
});
