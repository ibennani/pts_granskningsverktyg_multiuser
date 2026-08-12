/**
 * @fileoverview Kör unified snapshot-capture i en Chromium-session.
 */
import fs from 'fs/promises';
import path from 'path';
import type { Browser, Page, CDPSession } from 'puppeteer';
import {
    launch_capture_browser,
    prepare_capture_page,
    navigate_for_initial_consent_observation,
    apply_cached_consent_and_settle,
    capture_viewport_png_with_adjustments,
    CAPTURE_NAVIGATION_TIMEOUT_MS,
    type CaptureAdjustments,
} from './page_capture_session.js';
import {
    attach_console_listeners,
    attach_network_listeners,
    capture_extended_page_artifacts,
    create_network_capture_state,
    count_body_capture_issues,
    create_resource_body_persist_counters,
    persist_resource_bodies,
    push_body_unavailable_warning,
    push_cmp_banner_remaining_warning,
    push_resource_too_large_warning,
    sha256_buffer,
    to_network_json_entries,
    type ConsoleEntry,
    type SnapshotWarning,
} from '../snapshots/page_snapshot_cdp.js';
import { build_network_json } from '../snapshots/network_redaction.js';
import { build_snapshot_archive } from '../snapshots/audit_snapshot_archive.js';
import { get_snapshot_temp_capture_dir } from '../snapshots/audit_snapshot_storage.js';
import {
    get_snapshot_extended_cdp_max_ms,
    get_snapshot_yield_on_queue,
} from '../snapshots/audit_snapshot_config.js';
import { restore_baseline_viewport } from '../snapshots/analysis/snapshot_viewport_baseline.js';
import { capture_initial_consent_evidence } from '../snapshots/analysis/phase1/initial_consent_analysis.js';
import { run_snapshot_analysis } from '../snapshots/analysis/snapshot_analysis_runner.js';
import { load_consent_for_domain, apply_consent_cookies } from './page_screenshot_consent_cache.js';
import type { AuditSnapshotCaptureResponse } from '../schemas/audit_snapshot.js';

export type VisibleCaptureResult = AuditSnapshotCaptureResponse & {
    png_buffer: Buffer;
    page_title: string;
    final_url: string;
    adjustments: CaptureAdjustments;
};

export type RunCaptureJobContext = {
    audit_id: string;
    capture_id: string;
    url: string;
    attach_screenshot_to_sample: boolean;
    save_screenshot_to_media: (
        png_buffer: Buffer,
        page_title: string
    ) => Promise<{ filename: string | null; skipped: boolean }>;
    is_cancelled: () => boolean;
    should_yield_extended: () => boolean;
    on_visible_complete: (result: VisibleCaptureResult) => Promise<void>;
    on_packaging_start: () => Promise<void>;
};

async function write_temp_file(temp_dir: string, rel: string, content: string | Buffer): Promise<void> {
    const full = path.join(temp_dir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
}

async function extract_inline_styles_and_scripts(
    page: Page,
    temp_dir: string
): Promise<void> {
    const inline = await page.evaluate(() => {
        const styles = Array.from(document.querySelectorAll('style'))
            .map((el) => el.textContent || '')
            .filter(Boolean);
        const scripts = Array.from(document.querySelectorAll('script'))
            .map((el) => el.textContent || '')
            .filter(Boolean);
        return { styles, scripts };
    });
    await write_temp_file(
        temp_dir,
        'styles/inline-styles.json',
        JSON.stringify(inline.styles, null, 2)
    );
    await write_temp_file(
        temp_dir,
        'scripts/inline-scripts.json',
        JSON.stringify(inline.scripts, null, 2)
    );
}

async function run_persist_resource_bodies_pass(
    cdp: CDPSession,
    network_state: ReturnType<typeof create_network_capture_state>,
    temp_dir: string,
    counters: ReturnType<typeof create_resource_body_persist_counters>
): Promise<ReturnType<typeof create_resource_body_persist_counters>> {
    const result = await persist_resource_bodies(cdp, network_state, temp_dir, counters);
    return result.counters;
}

export async function run_snapshot_capture_job(ctx: RunCaptureJobContext): Promise<{
    size_bytes: number;
    warning_count: number;
    warnings: SnapshotWarning[];
}> {
    const temp_dir = get_snapshot_temp_capture_dir(ctx.audit_id, ctx.capture_id);
    await fs.mkdir(temp_dir, { recursive: true });

    let browser: Browser | undefined;
    let page: Page | undefined;
    let cdp: CDPSession | undefined;
    const console_entries: ConsoleEntry[] = [];
    const warnings: SnapshotWarning[] = [];
    const network_state = create_network_capture_state();
    const visible_started = Date.now();
    let body_counters = create_resource_body_persist_counters();
    const screenshot_budget = { remaining: 5 };

    try {
        if (ctx.is_cancelled()) throw new Error('Capture cancelled');

        browser = await launch_capture_browser();
        page = await browser.newPage();
        cdp = await page.createCDPSession();
        await prepare_capture_page(page);
        attach_console_listeners(page, console_entries);
        const frame_tree = await cdp.send('Page.getFrameTree') as {
            frameTree: { frame: { id: string } };
        };
        await attach_network_listeners(cdp, network_state, {
            main_frame_id: frame_tree.frameTree.frame.id,
        });

        await navigate_for_initial_consent_observation(page, ctx.url, CAPTURE_NAVIGATION_TIMEOUT_MS);
        if (ctx.is_cancelled()) throw new Error('Capture cancelled');

        const initial_consent_envelope = await capture_initial_consent_evidence(
            page,
            temp_dir,
            screenshot_budget
        );

        const consent = await load_consent_for_domain(ctx.url);
        await apply_consent_cookies(page, consent);
        await apply_cached_consent_and_settle(page, consent);

        body_counters = await run_persist_resource_bodies_pass(
            cdp,
            network_state,
            temp_dir,
            body_counters
        );

        const final_url = page.url();
        const capture = await capture_viewport_png_with_adjustments(page, ctx.url, {
            height_mode: 'full_document',
        });
        if (capture.adjustments.cookieBannerVisibleAfterCapture) {
            push_cmp_banner_remaining_warning(warnings);
        }
        await write_temp_file(temp_dir, 'screenshot.png', capture.png_buffer);

        await restore_baseline_viewport(page);

        let screenshot_outcome: VisibleCaptureResult['screenshot'] = {
            outcome: 'success',
            filename: undefined,
            size: capture.png_buffer.length,
            mime: 'image/png',
        };

        if (ctx.attach_screenshot_to_sample) {
            const media = await ctx.save_screenshot_to_media(capture.png_buffer, capture.page_title);
            if (media.skipped) {
                screenshot_outcome = { outcome: 'skipped' };
            } else if (media.filename) {
                screenshot_outcome.filename = media.filename;
            }
        } else {
            screenshot_outcome = { outcome: 'skipped' };
        }

        const visible_result: VisibleCaptureResult = {
            captureId: ctx.capture_id,
            snapshotStatus: 'capturing',
            pageTitle: { outcome: 'success', value: capture.page_title },
            screenshot: screenshot_outcome,
            png_buffer: capture.png_buffer,
            page_title: capture.page_title,
            final_url,
            adjustments: capture.adjustments,
        };

        await ctx.on_visible_complete(visible_result);

        if (!ctx.is_cancelled()) {
            body_counters = await run_persist_resource_bodies_pass(
                cdp,
                network_state,
                temp_dir,
                body_counters
            );
        }

        const extended_started = Date.now();
        const should_yield = (): boolean => {
            if (ctx.is_cancelled()) return true;
            if (get_snapshot_yield_on_queue() && ctx.should_yield_extended()) return true;
            return Date.now() - extended_started > get_snapshot_extended_cdp_max_ms();
        };

        const extended = await capture_extended_page_artifacts(page, cdp, { should_yield });
        warnings.push(...extended.warnings);
        if (should_yield() && get_snapshot_yield_on_queue() && ctx.should_yield_extended()) {
            warnings.push({
                code: 'extended_truncated',
                message: 'Extended capture truncated due to queue pressure',
            });
        }

        if (extended.rendered_html.trim()) {
            await write_temp_file(temp_dir, 'source.html', extended.rendered_html);
        } else {
            warnings.push({ code: 'source_html_unavailable', message: 'Source HTML unavailable' });
        }

        await write_temp_file(temp_dir, 'rendered.html', extended.rendered_html);
        await extract_inline_styles_and_scripts(page, temp_dir);

        if (extended.accessibility_tree) {
            await write_temp_file(
                temp_dir,
                'accessibility-tree.json',
                JSON.stringify(extended.accessibility_tree, null, 2)
            );
        }
        if (extended.dom_snapshot) {
            await write_temp_file(
                temp_dir,
                'dom-snapshot.json',
                JSON.stringify(extended.dom_snapshot, null, 2)
            );
        }
        if (extended.mhtml) {
            await write_temp_file(temp_dir, 'page.mhtml', extended.mhtml);
        }

        await write_temp_file(temp_dir, 'console.json', JSON.stringify(console_entries, null, 2));
        await write_temp_file(temp_dir, 'frames.json', JSON.stringify(extended.frames, null, 2));

        const network_json = build_network_json(to_network_json_entries(network_state.resources));
        await write_temp_file(temp_dir, 'network.json', JSON.stringify(network_json, null, 2));

        const final_body_issues = count_body_capture_issues(network_state);
        push_body_unavailable_warning(warnings, final_body_issues.body_unavailable_count);
        push_resource_too_large_warning(warnings, final_body_issues.resource_too_large_count);

        const analysis_summary = await run_snapshot_analysis({
            page,
            cdp,
            temp_dir,
            url: ctx.url,
            is_cancelled: ctx.is_cancelled,
            should_yield_extended: ctx.should_yield_extended,
            yield_on_queue: get_snapshot_yield_on_queue(),
            warnings,
            initial_consent_envelope,
        });

        const metadata = {
            formatVersion: 1,
            captureId: ctx.capture_id,
            auditId: ctx.audit_id,
            requestedUrl: ctx.url,
            finalUrl: final_url,
            pageTitle: capture.page_title,
            captureStartTimeUtc: new Date(visible_started).toISOString(),
            visiblePhaseCompletedAt: new Date().toISOString(),
            viewportWidth: 1280,
            viewportHeight: 800,
            deviceScaleFactor: 2,
            captureAdjustments: capture.adjustments,
            warningCount: warnings.length,
            networkRequestCount: network_state.resources.length,
            failedRequestCount: network_json.failedRequestCount,
            consoleErrorCount: console_entries.filter((e) => e.type === 'error').length,
            screenshotSha256: sha256_buffer(capture.png_buffer),
            analysisVersion: 1,
            analysis: {
                phase1Enabled: analysis_summary.index.phase1Enabled,
                phase2Enabled: analysis_summary.index.phase2Enabled,
                phase1Completed: analysis_summary.phase1_completed,
                phase2Completed: analysis_summary.phase2_completed,
                moduleCount: analysis_summary.module_count,
                warningCount: analysis_summary.warning_count,
            },
        };

        await ctx.on_packaging_start();
        const archive = await build_snapshot_archive({
            audit_id: ctx.audit_id,
            capture_id: ctx.capture_id,
            temp_dir,
            metadata,
            warnings,
            network_resources: [],
        });
        return {
            size_bytes: archive.size_bytes,
            warning_count: archive.warning_count,
            warnings,
        };
    } finally {
        if (cdp) {
            try {
                await cdp.detach();
            } catch {
                // ignore
            }
        }
        if (browser) {
            await browser.close();
        }
        try {
            await fs.rm(temp_dir, { recursive: true, force: true });
        } catch {
            // best-effort
        }
    }
}
