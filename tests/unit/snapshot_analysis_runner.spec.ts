/**
 * @fileoverview Enhetstester för analysrunner (felisolering).
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { run_analysis_module } from '../../server/snapshots/analysis/snapshot_analysis_module_runner.ts';
import type { AnalysisContext, AnalysisModuleDef } from '../../server/snapshots/analysis/snapshot_analysis_types.ts';

let temp_dir = '';

beforeEach(async () => {
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'analysis-runner-'));
});

afterEach(async () => {
    await fs.rm(temp_dir, { recursive: true, force: true });
});

function make_ctx(overrides: Partial<AnalysisContext> = {}): AnalysisContext {
    return {
        page: {} as AnalysisContext['page'],
        cdp: {} as AnalysisContext['cdp'],
        temp_dir,
        url: 'https://example.com',
        should_stop: () => false,
        should_skip_phase2: () => false,
        page_state_corrupted: () => false,
        mark_page_state_corrupted: () => {},
        warnings: [],
        shared: {},
        screenshot_budget: { remaining: 5 },
        ...overrides,
    };
}

describe('run_analysis_module', () => {
    test('modulfel ger failed utan att kasta', async () => {
        const def: AnalysisModuleDef = {
            name: 'test-fail',
            phase: 1,
            version: 1,
            output_path: 'analysis/phase1/test-fail.json',
            run: async () => {
                throw new Error('simulerat fel');
            },
        };
        const ctx = make_ctx();
        const result = await run_analysis_module(def, ctx);
        expect(result.status).toBe('failed');
        expect(ctx.warnings.some((w) => w.code === 'analysis_module_failed')).toBe(true);
    });

    test('should_stop ger skipped', async () => {
        const def: AnalysisModuleDef = {
            name: 'test-skip',
            phase: 1,
            version: 1,
            output_path: 'analysis/phase1/test-skip.json',
            run: async () => ({
                module: 'x',
                version: 1,
                phase: 1,
                status: 'success',
                durationMs: 0,
                recordCount: 0,
                truncated: false,
                skipReason: null,
                warnings: [],
                data: {},
            }),
        };
        const result = await run_analysis_module(def, make_ctx({ should_stop: () => true }));
        expect(result.status).toBe('skipped');
    });
});
