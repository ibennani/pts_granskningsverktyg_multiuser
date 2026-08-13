/**
 * @fileoverview Enhetstester för snapshot-analys browser_scripts.
 */
import { describe, test, expect } from '@jest/globals';
import {
    BROWSER_COLLECT_PAGE_BLOCK_CANDIDATES,
    BROWSER_FIND_MENU_NAVIGATION_TRIGGER,
    BROWSER_READ_MENU_TRIGGER_STATE,
} from '../../server/snapshots/analysis/snapshot_analysis_browser_scripts_loader.ts';

describe('snapshot_analysis_browser_scripts_loader', () => {
    test('laddar page-blocks utan tsx __name-injektion', () => {
        const source = BROWSER_COLLECT_PAGE_BLOCK_CANDIDATES.toString();
        expect(source.includes('__name')).toBe(false);
        expect(source.startsWith('function browser_collect_page_block_candidates')).toBe(true);
    });

    test('laddar menu-navigation-triggers utan tsx __name-injektion', () => {
        const trigger_source = BROWSER_FIND_MENU_NAVIGATION_TRIGGER.toString();
        expect(trigger_source.includes('__name')).toBe(false);
        const state_source = BROWSER_READ_MENU_TRIGGER_STATE.toString();
        expect(state_source.includes('__name')).toBe(false);
    });
});
