/**
 * @fileoverview Enhetstester för snapshot-analyskonfiguration.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
    get_snapshot_analysis_phase1_enabled,
    get_snapshot_analysis_phase2_enabled,
    get_snapshot_analysis_tab_max_steps,
    get_default_analysis_capabilities,
} from '../../server/snapshots/analysis/snapshot_analysis_config.ts';

describe('snapshot_analysis_config', () => {
    const env_backup: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const key of [
            'GV_SNAPSHOT_ANALYSIS_PHASE1_ENABLED',
            'GV_SNAPSHOT_ANALYSIS_PHASE2_ENABLED',
            'GV_SNAPSHOT_ANALYSIS_TAB_MAX_STEPS',
        ]) {
            env_backup[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const [key, value] of Object.entries(env_backup)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    test('fas 1 är på som default', () => {
        expect(get_snapshot_analysis_phase1_enabled()).toBe(true);
    });

    test('fas 2 är på som default', () => {
        expect(get_snapshot_analysis_phase2_enabled()).toBe(true);
    });

    test('tab max steps default 200', () => {
        expect(get_snapshot_analysis_tab_max_steps()).toBe(200);
    });

    test('three-flashes markeras ej implementerad', () => {
        const caps = get_default_analysis_capabilities();
        const flash = caps.find((c) => c.id === 'three-flashes');
        expect(flash?.implemented).toBe(false);
    });
});
