/**
 * @fileoverview Enhetstester för domän-cache av overlay-dismiss.
 */
import { describe, test, expect } from '@jest/globals';
import {
    dedupe_string_list,
    has_usable_overlay_hint_snapshot,
    is_safe_overlay_selector,
    merge_overlay_domain_hints,
    merge_overlay_hint_snapshots,
    overlay_hints_from_dismiss_result,
    sanitize_overlay_domain_hints,
} from '../../server/services/page_screenshot_intrusive_overlay_cache_logic.ts';

describe('page_screenshot_intrusive_overlay_cache_logic', () => {
    test('is_safe_overlay_selector avvisar farliga selectors', () => {
        expect(is_safe_overlay_selector('button.close')).toBe(true);
        expect(is_safe_overlay_selector('triggerbee-widget')).toBe(true);
        expect(is_safe_overlay_selector('a{b}')).toBe(false);
        expect(is_safe_overlay_selector('javascript:alert(1)')).toBe(false);
    });

    test('merge_overlay_domain_hints prioriterar inkommande selectors först', () => {
        const merged = merge_overlay_domain_hints(
            { close_selectors: ['.old'] },
            { close_selectors: ['.new'] }
        );
        expect(merged.close_selectors).toEqual(['.new', '.old']);
    });

    test('overlay_hints_from_dismiss_result ignorerar escape och generiska hints', () => {
        expect(
            overlay_hints_from_dismiss_result({ kind: 'close_selector', value: 'keyboard:escape' })
        ).toBeNull();
        expect(
            overlay_hints_from_dismiss_result({ kind: 'close_selector', value: 'button.icon-close-in-corner' })
        ).toBeNull();
        expect(
            overlay_hints_from_dismiss_result({ kind: 'shadow_host', value: 'triggerbee-widget' })
        ).toEqual({ shadow_host_selectors: ['triggerbee-widget'] });
    });

    test('merge_overlay_hint_snapshots slår ihop hints från två snapshots', () => {
        const merged = merge_overlay_hint_snapshots(
            {
                domain: 'example.com',
                updated_at: '2026-01-01T00:00:00.000Z',
                source: 'manual',
                hints: { close_selectors: ['.seed'] },
            },
            {
                domain: 'example.com',
                updated_at: '2026-06-01T00:00:00.000Z',
                source: 'learned',
                hints: { shadow_host_selectors: ['triggerbee-widget'] },
            }
        );
        expect(merged.hints.close_selectors).toContain('.seed');
        expect(merged.hints.shadow_host_selectors).toContain('triggerbee-widget');
        expect(has_usable_overlay_hint_snapshot(merged)).toBe(true);
    });

    test('dedupe_string_list tar bort dubbletter', () => {
        expect(dedupe_string_list(['a', 'a', 'b'])).toEqual(['a', 'b']);
    });

    test('sanitize_overlay_domain_hints filtrerar osäkra selectors', () => {
        const sanitized = sanitize_overlay_domain_hints({
            close_selectors: ['.ok', 'a{b}'],
            hide_selectors: ['#widget'],
        });
        expect(sanitized.close_selectors).toEqual(['.ok']);
        expect(sanitized.hide_selectors).toEqual(['#widget']);
    });
});
