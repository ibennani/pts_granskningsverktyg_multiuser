/**
 * @fileoverview Enhetstester för tabellpaginering.
 */

import { describe, it, expect } from '@jest/globals';
import {
    audit_page_size_string_to_number,
    total_pages,
    clamp_page_index,
    visible_row_range_one_based,
    slice_rows_for_page
} from '../../js/logic/table_pagination_logic.js';

describe('audit_page_size_string_to_number', () => {
    it('returnerar null för alla', () => {
        expect(audit_page_size_string_to_number('all')).toBeNull();
        expect(audit_page_size_string_to_number('Alla')).toBeNull();
    });

    it('returnerar heltal för siffror', () => {
        expect(audit_page_size_string_to_number('25')).toBe(25);
    });

    it('fallback 10 för ogiltigt', () => {
        expect(audit_page_size_string_to_number('')).toBe(10);
        expect(audit_page_size_string_to_number('x')).toBe(10);
    });
});

describe('total_pages', () => {
    it('räknar sidor', () => {
        expect(total_pages(0, 10)).toBe(1);
        expect(total_pages(10, 10)).toBe(1);
        expect(total_pages(11, 10)).toBe(2);
        expect(total_pages(45, 10)).toBe(5);
    });

    it('null sidstorlek ger en sida', () => {
        expect(total_pages(100, null)).toBe(1);
    });
});

describe('clamp_page_index', () => {
    it('klampar till giltigt intervall', () => {
        expect(clamp_page_index(99, 5, 10)).toBe(0);
        expect(clamp_page_index(-3, 20, 10)).toBe(0);
        expect(clamp_page_index(1, 25, 10)).toBe(1);
    });
});

describe('visible_row_range_one_based', () => {
    it('första sidan', () => {
        expect(visible_row_range_one_based(0, 10, 45)).toEqual({ start: 1, end: 10 });
    });

    it('sista sidan', () => {
        expect(visible_row_range_one_based(4, 10, 45)).toEqual({ start: 41, end: 45 });
    });

    it('alla rader', () => {
        expect(visible_row_range_one_based(0, null, 3)).toEqual({ start: 1, end: 3 });
    });
});

describe('slice_rows_for_page', () => {
    it('slice på sida', () => {
        const rows = [1, 2, 3, 4, 5];
        expect(slice_rows_for_page(rows, 0, 2)).toEqual([1, 2]);
        expect(slice_rows_for_page(rows, 1, 2)).toEqual([3, 4]);
        expect(slice_rows_for_page(rows, 2, 2)).toEqual([5]);
    });

    it('alla utan slice', () => {
        const rows = [1, 2, 3];
        expect(slice_rows_for_page(rows, 0, null)).toEqual(rows);
    });
});
