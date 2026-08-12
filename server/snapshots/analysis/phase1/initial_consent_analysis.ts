/**
 * @fileoverview Fas 1.8 – initial consent-evidens från en separat, opåverkad observationssida.
 */
import type { Frame, Page } from 'puppeteer';
import type { AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { BROWSER_COLLECT_INITIAL_CONSENT_CANDIDATES } from './initial_consent_browser_scripts_loader.js';
import { get_snapshot_analysis_consent_wait_ms } from '../snapshot_analysis_config.js';
import { write_analysis_png } from '../snapshot_analysis_io.js';
import {
    CMP_CONSENT_CONTEXT_KEYWORDS,
    build_cmp_banner_container_selectors,
} from '../../../services/cmp/cmp_pattern_families.js';
import { CMP_VENDORS } from '../../../services/cmp/cmp_vendors/registry.js';

function build_initial_consent_config() {
    return {
        container_selectors: build_cmp_banner_container_selectors(),
        consent_context_keywords: [...CMP_CONSENT_CONTEXT_KEYWORDS],
        vendors: CMP_VENDORS.map((vendor) => ({
            id: vendor.id,
            banner_container_selectors: [...(vendor.banner_container_selectors || [])],
        })),
    };
}

function get_frames(page: Page): Frame[] {
    try {
        return page.frames();
    } catch {
        return [page.mainFrame()];
    }
}

async function collect_from_frames(page: Page): Promise<Array<Record<string, unknown>>> {
    const config = build_initial_consent_config();
    const collected: Array<Record<string, unknown>> = [];
    const frames = get_frames(page);

    for (let index = 0; index < frames.length; index++) {
        const frame = frames[index];
        try {
            const results = await frame.evaluate(
                BROWSER_COLLECT_INITIAL_CONSENT_CANDIDATES as (
                    cfg: ReturnType<typeof build_initial_consent_config>
                ) => Array<Record<string, unknown>>,
                config
            );
            for (const result of results) {
                collected.push({
                    ...result,
                    frame: {
                        index,
                        url: frame.url(),
                        isMainFrame: frame === page.mainFrame(),
                    },
                });
            }
        } catch {
            // En enskild frame får inte stoppa observationen.
        }
    }
    return collected;
}

export async function capture_initial_consent_evidence(
    page: Page,
    temp_dir: string,
    screenshot_budget: { remaining: number }
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const wait_ms = get_snapshot_analysis_consent_wait_ms();
    const deadline = Date.now() + wait_ms;
    let banners: Array<Record<string, unknown>> = [];

    while (Date.now() < deadline) {
        banners = await collect_from_frames(page);
        if (banners.length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (banners.length === 0) {
        return {
            module: 'initial-consent',
            version: 2,
            phase: 1,
            status: 'skipped',
            durationMs: Date.now() - started,
            recordCount: 0,
            truncated: false,
            skipReason: 'no-consent-ui',
            warnings: [],
            data: {
                consentUiFound: false,
                observationMode: 'clean-no-interaction',
                banners: [],
            },
        };
    }

    let screenshot_taken = false;
    if (screenshot_budget.remaining > 0) {
        const png = await page.screenshot({ type: 'png', fullPage: false });
        await write_analysis_png(temp_dir, 'analysis/phase1/initial-consent.png', Buffer.from(png));
        screenshot_budget.remaining -= 1;
        screenshot_taken = true;
    }

    return {
        module: 'initial-consent',
        version: 2,
        phase: 1,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: banners.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: {
            consentUiFound: true,
            observationMode: 'clean-no-interaction',
            banners,
            screenshotTaken: screenshot_taken,
            interacted: false,
        },
    };
}
