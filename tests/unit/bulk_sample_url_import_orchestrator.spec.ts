/**
 * @fileoverview Enhetstester för bulk_url_import_parse och orkestratorhjälpare.
 */
import { describe, test, expect } from '@jest/globals';
import { parse_bulk_url_list, count_valid_bulk_urls } from '../../js/logic/bulk_url_import_parse.ts';

describe('bulk_url_import_parse', () => {
    test('normaliserar och tar bort dubbletter', () => {
        const rows = parse_bulk_url_list('https://example.com\nhttps://example.com/\n\nfoo');
        expect(count_valid_bulk_urls(rows)).toBe(1);
        expect(rows.find((r) => r.error_key === 'bulk_url_import_duplicate_url')).toBeTruthy();
        expect(rows.find((r) => r.error_key === 'bulk_url_import_invalid_url')).toBeTruthy();
    });
});
