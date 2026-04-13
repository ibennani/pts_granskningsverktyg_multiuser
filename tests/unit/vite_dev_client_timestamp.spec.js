import { describe, expect, it } from '@jest/globals';
import { resolve_dev_build_display_moment } from '../../js/utils/vite_dev_client_timestamp.js';

describe('resolve_dev_build_display_moment', () => {
    it('använder BUILD_INFO när Vite-stämpel saknas', () => {
        const iso = '2026-04-13T08:14:10.000Z';
        const d = resolve_dev_build_display_moment(iso, null);
        expect(d.toISOString()).toBe(iso);
    });

    it('använder Vite-stämpel när BUILD_INFO saknas', () => {
        const vite = new Date('2026-04-13T14:53:22.000Z');
        const d = resolve_dev_build_display_moment(undefined, vite);
        expect(d.toISOString()).toBe(vite.toISOString());
    });

    it('väljer senare av BUILD_INFO och Vite-stämpel', () => {
        const older = '2026-04-13T08:14:10.000Z';
        const vite = new Date('2026-04-13T14:53:22.000Z');
        expect(resolve_dev_build_display_moment(older, vite).toISOString()).toBe(vite.toISOString());

        const newer = '2026-04-13T16:00:00.000Z';
        const vite2 = new Date('2026-04-13T14:53:22.000Z');
        expect(resolve_dev_build_display_moment(newer, vite2).toISOString()).toBe(new Date(newer).toISOString());
    });

    it('returnerar nu om båda saknas', () => {
        const before = Date.now();
        const d = resolve_dev_build_display_moment(undefined, null);
        const after = Date.now();
        expect(d.getTime()).toBeGreaterThanOrEqual(before);
        expect(d.getTime()).toBeLessThanOrEqual(after);
    });
});
