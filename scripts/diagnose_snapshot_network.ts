/**
 * @fileoverview Diagnostiserar vilka nätverksresurser misslyckas vid Apohem-capture lokalt.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
    launch_capture_browser,
    prepare_capture_page,
    navigate_for_screenshot_capture,
    CAPTURE_NAVIGATION_TIMEOUT_MS,
} from '../server/services/page_capture_session.ts';
import {
    attach_network_listeners,
    create_network_capture_state,
    persist_resource_bodies,
    create_resource_body_persist_counters,
    await_eager_resource_body_captures,
    to_network_json_entries,
} from '../server/snapshots/page_snapshot_cdp.ts';

const url =
    process.argv[2] ||
    'https://www.apohem.se/sar-bett-stick/sar/sartvatt/ekodes-smart-desinfektion-100-ml';

const temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-diagnose-'));
const browser = await launch_capture_browser();
const page = await browser.newPage();
const cdp = await page.createCDPSession();
const state = create_network_capture_state();

await prepare_capture_page(page);
await attach_network_listeners(cdp, state, { main_frame_id: page.mainFrame()._id });
await navigate_for_screenshot_capture(page, url, CAPTURE_NAVIGATION_TIMEOUT_MS);
await await_eager_resource_body_captures(state);

const counters = create_resource_body_persist_counters();
const result = await persist_resource_bodies(cdp, state, temp_dir, counters);

const entries = to_network_json_entries(state.resources);
const skipped = entries.filter((r) => r.bodySkipReason);
const captured = entries.filter((r) => r.bodyCaptured);

console.log(
    JSON.stringify(
        {
            url,
            total: entries.length,
            captured: captured.length,
            skipped: skipped.length,
            persist_result: result,
            skipped_samples: skipped.slice(0, 15).map((r) => ({
                url: r.url.slice(0, 100),
                type: r.resourceType,
                mime: r.mimeType,
                status: r.status,
                failed: r.failed,
                reason: r.bodySkipReason,
            })),
        },
        null,
        2
    )
);

await browser.close();
await fs.rm(temp_dir, { recursive: true, force: true });
