/**
 * @fileoverview Enhetstester för SSRF-skydd vid URL-skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import { assert_public_http_url, SsrfUrlRejectedError } from '../../server/utils/ssrf_url_guard.ts';

describe('ssrf_url_guard', () => {
    test('tillåter publik https-URL', () => {
        const parsed = assert_public_http_url('https://example.com/sida');
        expect(parsed.hostname).toBe('example.com');
    });

    test('tillåter publik http-URL', () => {
        const parsed = assert_public_http_url('http://example.org');
        expect(parsed.protocol).toBe('http:');
    });

    test('blockerar localhost', () => {
        expect(() => assert_public_http_url('http://localhost/test')).toThrow(SsrfUrlRejectedError);
    });

    test('blockerar privat IP', () => {
        expect(() => assert_public_http_url('http://192.168.1.1/')).toThrow(SsrfUrlRejectedError);
    });

    test('blockerar file-protokoll', () => {
        expect(() => assert_public_http_url('file:///etc/passwd')).toThrow(SsrfUrlRejectedError);
    });

    test('blockerar ogiltig URL', () => {
        expect(() => assert_public_http_url('inte-en-url')).toThrow(SsrfUrlRejectedError);
    });
});
