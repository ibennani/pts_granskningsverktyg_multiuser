/**
 * @fileoverview Enhetstest för CMP- och overlay-varningar i sidrapporter.
 */
import { describe, test, expect } from '@jest/globals';
import {
    push_cmp_banner_remaining_warning,
    push_intrusive_overlay_remaining_warning,
} from '../../server/snapshots/page_snapshot_cdp.ts';

describe('push_cmp_banner_remaining_warning', () => {
    test('lägger till cmp_banner_remaining', () => {
        const warnings: Array<{ code: string; message: string }> = [];
        push_cmp_banner_remaining_warning(warnings);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].code).toBe('cmp_banner_remaining');
    });
});

describe('push_intrusive_overlay_remaining_warning', () => {
    test('lägger till intrusive_overlay_remaining', () => {
        const warnings: Array<{ code: string; message: string }> = [];
        push_intrusive_overlay_remaining_warning(warnings);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].code).toBe('intrusive_overlay_remaining');
    });
});
