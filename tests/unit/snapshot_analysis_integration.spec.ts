/**
 * @fileoverview Integrationstester för snapshot-analys mot lokala fixtures.
 * @jest-environment node
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { start_snapshot_fixture_server } from './snapshot_analysis_fixture_server.ts';
import { run_keyboard_analysis } from '../../server/snapshots/analysis/phase1/keyboard_analysis.ts';
import { run_contrast_analysis } from '../../server/snapshots/analysis/phase1/contrast_analysis.ts';
import { capture_initial_consent_evidence } from '../../server/snapshots/analysis/phase1/initial_consent_analysis.ts';
import { run_reflow_analysis } from '../../server/snapshots/analysis/phase1/reflow_analysis.ts';
import { restore_baseline_viewport } from '../../server/snapshots/analysis/snapshot_viewport_baseline.ts';
import { run_snapshot_analysis } from '../../server/snapshots/analysis/snapshot_analysis_runner.ts';
import type { AnalysisContext } from '../../server/snapshots/analysis/snapshot_analysis_types.ts';

let fixture_server: Awaited<ReturnType<typeof start_snapshot_fixture_server>>;
let temp_dir = '';

beforeAll(async () => {
    fixture_server = await start_snapshot_fixture_server();
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-int-'));
}, 60_000);

afterAll(async () => {
    if (fixture_server) await fixture_server.close();
    if (temp_dir) await fs.rm(temp_dir, { recursive: true, force: true });
}, 30_000);

async function with_page(
    fn: (page: Page) => Promise<void>,
    viewport?: { width: number; height: number; deviceScaleFactor?: number }
): Promise<void> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
        const page = await browser.newPage();
        if (viewport) await page.setViewport(viewport);
        await fn(page);
    } finally {
        await browser.close();
    }
}

function make_ctx(page: Page): AnalysisContext {
    return {
        page,
        cdp: {} as AnalysisContext['cdp'],
        temp_dir,
        url: page.url(),
        should_stop: () => false,
        should_skip_phase2: () => false,
        page_state_corrupted: () => false,
        mark_page_state_corrupted: () => {},
        warnings: [],
        shared: {},
        screenshot_budget: { remaining: 5 },
    };
}

describe('snapshot_analysis integration', () => {
    test('keyboard registrerar Tab-steg i ordning', async () => {
        await with_page(
            async (page) => {
                await page.goto(`${fixture_server.base_url}/focus-nav.html`, { waitUntil: 'load' });
                const result = await run_keyboard_analysis(make_ctx(page));
                expect(result.status).toBe('success');
                expect(result.recordCount).toBeGreaterThan(0);
                const data = result.data as { forwardSteps: Array<{ index: number }> };
                expect(data.forwardSteps[0]?.index).toBe(0);
            },
            { width: 1280, height: 800, deviceScaleFactor: 2 }
        );
    }, 60_000);

    test('contrast ger measurable ratio för enkel text', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/contrast-simple.html`, { waitUntil: 'load' });
            const result = await run_contrast_analysis(make_ctx(page));
            const data = result.data as { records: Array<{ measurable: boolean; contrastRatio?: number }> };
            const measurable = data.records.find((r) => r.measurable && r.contrastRatio);
            expect(measurable).toBeTruthy();
        });
    }, 60_000);

    test('gradient background markeras measurable false', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/gradient-bg.html`, { waitUntil: 'load' });
            const result = await run_contrast_analysis(make_ctx(page));
            const data = result.data as { records: Array<{ measurable: boolean; reason?: string }> };
            expect(data.records.some((r) => r.measurable === false)).toBe(true);
        });
    }, 60_000);

    test('reflow upptäcker overflow vid 320px och återställer viewport', async () => {
        await with_page(
            async (page) => {
                await page.goto(`${fixture_server.base_url}/reflow-overflow.html`, { waitUntil: 'load' });
                await run_reflow_analysis(make_ctx(page));
                const vp = page.viewport();
                expect(vp?.width).toBe(1280);
                expect(vp?.height).toBe(800);
            },
            { width: 1280, height: 800, deviceScaleFactor: 2 }
        );
    }, 60_000);

    test('consent-banner ger evidens', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/consent-banner.html`, { waitUntil: 'load' });
            const result = await capture_initial_consent_evidence(page, temp_dir, { remaining: 5 });
            expect(result.status).toBe('success');
            expect(result.recordCount).toBeGreaterThan(0);
        });
    }, 60_000);

    test('ingen consent-banner ger skipped', async () => {
        await with_page(async (page) => {
            await page.goto(`${fixture_server.base_url}/focus-nav.html`, { waitUntil: 'load' });
            const result = await capture_initial_consent_evidence(page, temp_dir, { remaining: 5 });
            expect(result.status).toBe('skipped');
            expect(result.skipReason).toBe('no-consent-ui');
        });
    }, 60_000);

    test('run_snapshot_analysis skriver analysis/index.json med fas 2 när påslagen', async () => {
        const prev = {
            phase1: process.env.GV_SNAPSHOT_ANALYSIS_PHASE1_ENABLED,
            phase2: process.env.GV_SNAPSHOT_ANALYSIS_PHASE2_ENABLED,
            max_ms: process.env.GV_SNAPSHOT_ANALYSIS_MAX_MS,
            dynamic_ms: process.env.GV_SNAPSHOT_ANALYSIS_DYNAMIC_MS,
            tab_steps: process.env.GV_SNAPSHOT_ANALYSIS_TAB_MAX_STEPS,
        };
        process.env.GV_SNAPSHOT_ANALYSIS_PHASE1_ENABLED = 'false';
        process.env.GV_SNAPSHOT_ANALYSIS_PHASE2_ENABLED = 'true';
        process.env.GV_SNAPSHOT_ANALYSIS_MAX_MS = '120000';
        process.env.GV_SNAPSHOT_ANALYSIS_DYNAMIC_MS = '500';
        process.env.GV_SNAPSHOT_ANALYSIS_TAB_MAX_STEPS = '15';

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
            await page.goto(`${fixture_server.base_url}/focus-nav.html`, { waitUntil: 'load' });
            const cdp = await page.createCDPSession();
            const sub_temp = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-index-'));
            const summary = await run_snapshot_analysis({
                page,
                cdp,
                temp_dir: sub_temp,
                url: page.url(),
                is_cancelled: () => false,
                should_yield_extended: () => false,
                yield_on_queue: false,
                warnings: [],
                initial_consent_envelope: null,
            });
            expect(summary.index.phase2Enabled).toBe(true);
            const index_raw = await fs.readFile(path.join(sub_temp, 'analysis/index.json'), 'utf8');
            const index = JSON.parse(index_raw);
            expect(index.modules.some((m: { phase: number }) => m.phase === 2)).toBe(true);
            await cdp.detach();
            await fs.rm(sub_temp, { recursive: true, force: true });
        } finally {
            await browser.close();
        }

        for (const [key, value] of Object.entries(prev)) {
            const env_key =
                key === 'phase1'
                    ? 'GV_SNAPSHOT_ANALYSIS_PHASE1_ENABLED'
                    : key === 'phase2'
                      ? 'GV_SNAPSHOT_ANALYSIS_PHASE2_ENABLED'
                      : key === 'max_ms'
                        ? 'GV_SNAPSHOT_ANALYSIS_MAX_MS'
                        : key === 'dynamic_ms'
                          ? 'GV_SNAPSHOT_ANALYSIS_DYNAMIC_MS'
                          : 'GV_SNAPSHOT_ANALYSIS_TAB_MAX_STEPS';
            if (value === undefined) delete process.env[env_key];
            else process.env[env_key] = value;
        }
    }, 180_000);

    test('restore_baseline_viewport återställer efter höjdändring', async () => {
        await with_page(
            async (page) => {
                await restore_baseline_viewport(page);
                const vp = page.viewport();
                expect(vp?.width).toBe(1280);
                expect(vp?.height).toBe(800);
            },
            { width: 1280, height: 4000, deviceScaleFactor: 2 }
        );
    }, 60_000);
});
