/**
 * @fileoverview Fas 1.8 – initial consent-evidens (körs före cached consent på separat page).
 */
import type { Page } from 'puppeteer';
import type { AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { detect_consent_ui_in_page } from '../../../services/cmp/cmp_consent_detection.js';
import { get_snapshot_analysis_consent_wait_ms } from '../snapshot_analysis_config.js';
import { write_analysis_png } from '../snapshot_analysis_io.js';

export async function capture_initial_consent_evidence(
    page: Page,
    temp_dir: string,
    screenshot_budget: { remaining: number }
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const wait_ms = get_snapshot_analysis_consent_wait_ms();
    const deadline = Date.now() + wait_ms;
    let banners: Awaited<ReturnType<typeof detect_consent_ui_in_page>> = [];

    while (Date.now() < deadline) {
        banners = await detect_consent_ui_in_page(page);
        if (banners.length > 0) break;
        await new Promise((r) => setTimeout(r, 250));
    }

    if (banners.length === 0) {
        return {
            module: 'initial-consent',
            version: 1,
            phase: 1,
            status: 'skipped',
            durationMs: Date.now() - started,
            recordCount: 0,
            truncated: false,
            skipReason: 'no-consent-ui',
            warnings: [],
            data: { consentUiFound: false, banners: [] },
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
        version: 1,
        phase: 1,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: banners.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: {
            consentUiFound: true,
            banners,
            screenshotTaken: screenshot_taken,
            reloadRequiredAfterConsent: false,
        },
    };
}
