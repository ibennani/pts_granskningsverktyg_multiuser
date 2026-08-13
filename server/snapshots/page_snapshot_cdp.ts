/**
 * @fileoverview CDP-insamling för tekniska snapshots.
 */
import { createHash } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Page, CDPSession } from 'puppeteer';
import {
    sanitize_response_headers,
    type NetworkResourceEntry,
} from './network_redaction.js';
import {
    get_snapshot_resource_text_max_bytes,
    get_snapshot_network_buffer_per_resource,
    get_snapshot_network_buffer_total,
} from './audit_snapshot_config.js';

export type SnapshotWarning = {
    code: string;
    message: string;
};

export type ConsoleEntry = {
    type: string;
    text: string;
    timestamp: string;
    location: string | null;
};

export type FrameEntry = {
    url: string;
    name: string | null;
    parentFrameId: string | null;
    isMainFrame: boolean;
};

/** Computed style properties captured in dom-snapshot.json (order matters). */
export const DOM_SNAPSHOT_COMPUTED_STYLES = [
    'display', 'visibility', 'color', 'background-color', 'font-size',
    'font-weight', 'line-height', 'opacity', 'position', 'width', 'height',
    'overflow', 'white-space', 'text-decoration', 'outline', 'content', 'transform',
    'outline-style', 'outline-width', 'outline-color', 'outline-offset',
    'box-shadow',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'background-image', 'text-shadow',
] as const;

type PendingResource = {
    requestId: string;
    url: string;
    method: string;
    resourceType: string;
    mimeType: string | null;
    status: number | null;
    encodedSize: number | null;
    decodedSize: number | null;
    failed: boolean;
    failureReason: string | null;
    redirectChain: string[];
    responseHeaders: Record<string, string>;
    bodyCaptured: boolean;
    bodySkipReason: string | null;
    archiveRelativePath: string | null;
    /** Kroppsbytes hämtade direkt vid Network.loadingFinished. */
    pendingBodyBytes: Buffer | null;
};

export type NetworkCaptureState = {
    resources: PendingResource[];
    mainDocumentRequestId: string | null;
    mainDocumentBody: string | null;
    eager_capture_tasks: Promise<void>[];
};

export function create_network_capture_state(): NetworkCaptureState {
    return {
        resources: [],
        mainDocumentRequestId: null,
        mainDocumentBody: null,
        eager_capture_tasks: [],
    };
}

export async function await_eager_resource_body_captures(state: NetworkCaptureState): Promise<void> {
    if (state.eager_capture_tasks.length === 0) return;
    await Promise.allSettled(state.eager_capture_tasks);
    state.eager_capture_tasks = [];
}

export function decode_cdp_response_body(body_result: {
    body: string;
    base64Encoded: boolean;
}): Buffer {
    return body_result.base64Encoded
        ? Buffer.from(body_result.body, 'base64')
        : Buffer.from(body_result.body, 'utf8');
}

export function is_resource_body_capture_candidate(
    resource: Pick<PendingResource, 'failed' | 'mimeType' | 'resourceType'>
): boolean {
    if (resource.failed) return false;
    const mime = (resource.mimeType || '').toLowerCase();
    const is_css = mime.includes('css') || resource.resourceType === 'Stylesheet';
    const is_js =
        mime.includes('javascript') ||
        mime.includes('ecmascript') ||
        resource.resourceType === 'Script';
    return is_css || is_js;
}

export function push_body_unavailable_warning(
    warnings: SnapshotWarning[],
    body_unavailable_count: number
): void {
    if (body_unavailable_count <= 0) return;
    warnings.push({
        code: 'body_unavailable',
        message:
            body_unavailable_count === 1
                ? 'One network resource body could not be captured'
                : `${body_unavailable_count} network resource bodies could not be captured`,
    });
}

export function push_resource_too_large_warning(
    warnings: SnapshotWarning[],
    resource_too_large_count: number
): void {
    if (resource_too_large_count <= 0) return;
    warnings.push({
        code: 'resource_too_large',
        message:
            resource_too_large_count === 1
                ? 'One resource body exceeded size limit'
                : `${resource_too_large_count} resource bodies exceeded size limit`,
    });
}

export function push_cmp_banner_remaining_warning(warnings: SnapshotWarning[]): void {
    warnings.push({
        code: 'cmp_banner_remaining',
        message: 'Cookie banner may still be visible after capture adjustments',
    });
}

export function push_intrusive_overlay_remaining_warning(warnings: SnapshotWarning[]): void {
    warnings.push({
        code: 'intrusive_overlay_remaining',
        message: 'Intrusive overlay may still be visible after capture adjustments',
    });
}

export async function attach_network_listeners(
    cdp: CDPSession,
    state: NetworkCaptureState,
    options: { main_frame_id: string }
): Promise<void> {
    const main_frame_id = options.main_frame_id;
    const max_bytes = get_snapshot_resource_text_max_bytes();

    const capture_body_eager = async (entry: PendingResource): Promise<void> => {
        if (entry.bodyCaptured || entry.pendingBodyBytes || entry.bodySkipReason) return;
        if (!is_resource_body_capture_candidate(entry)) return;
        try {
            const body_result = await cdp.send('Network.getResponseBody', {
                requestId: entry.requestId,
            });
            const raw = decode_cdp_response_body(body_result);
            if (raw.length > max_bytes) {
                entry.bodySkipReason = 'resource exceeded size limit';
                return;
            }
            entry.pendingBodyBytes = raw;
        } catch {
            // Låt persist-pass försöka igen; kroppen kan bli tillgänglig strax efter loadingFinished.
        }
    };

    await cdp.send('Network.enable', {
        maxResourceBufferSize: get_snapshot_network_buffer_per_resource(),
        maxTotalBufferSize: get_snapshot_network_buffer_total(),
    });
    cdp.on('Network.requestWillBeSent', (event) => {
        const resource_type = event.type ?? 'Other';
        const existing = state.resources.find((r) => r.requestId === event.requestId);
        const redirect_chain = existing?.redirectChain ?? [];
        if (event.redirectResponse?.url) {
            redirect_chain.push(event.redirectResponse.url);
        }
        const entry: PendingResource = existing ?? {
            requestId: event.requestId,
            url: event.request.url,
            method: event.request.method,
            resourceType: resource_type,
            mimeType: null,
            status: null,
            encodedSize: null,
            decodedSize: null,
            failed: false,
            failureReason: null,
            redirectChain: redirect_chain,
            responseHeaders: {},
            bodyCaptured: false,
            bodySkipReason: null,
            archiveRelativePath: null,
            pendingBodyBytes: null,
        };
        entry.url = event.request.url;
        entry.method = event.request.method;
        entry.resourceType = resource_type;
        if (resource_type === 'Document' && event.frameId === main_frame_id) {
            state.mainDocumentRequestId = event.requestId;
        }
        if (!existing) state.resources.push(entry);
    });
    cdp.on('Network.responseReceived', (event: { requestId: string; frameId?: string; response: { url: string; mimeType: string; status: number; headers: Record<string, string> } }) => {
        const entry = state.resources.find((r) => r.requestId === event.requestId);
        if (!entry) return;
        entry.mimeType = event.response.mimeType ?? null;
        entry.status = event.response.status;
        entry.responseHeaders = sanitize_response_headers(event.response.headers);
        if (entry.resourceType === 'Document' && event.frameId === main_frame_id) {
            state.mainDocumentRequestId = event.requestId;
        }
    });
    cdp.on('Network.loadingFinished', (event: { requestId: string; encodedDataLength: number }) => {
        const entry = state.resources.find((r) => r.requestId === event.requestId);
        if (!entry) return;
        entry.encodedSize = event.encodedDataLength;
        const task = capture_body_eager(entry);
        state.eager_capture_tasks.push(task);
    });
    cdp.on('Network.loadingFailed', (event: { requestId: string; errorText: string }) => {
        const entry = state.resources.find((r) => r.requestId === event.requestId);
        if (!entry) return;
        entry.failed = true;
        entry.failureReason = event.errorText;
    });
}

export function attach_console_listeners(page: Page, entries: ConsoleEntry[]): void {
    page.on('console', (msg) => {
        entries.push({
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString(),
            location: msg.location()?.url ?? null,
        });
    });
    page.on('pageerror', (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        entries.push({
            type: 'error',
            text: message,
            timestamp: new Date().toISOString(),
            location: null,
        });
    });
}

function safe_resource_filename(index: number, ext: string): string {
    return `resource-${String(index).padStart(4, '0')}.${ext}`;
}

export type ResourceBodyPersistCounters = {
    css_index: number;
    js_index: number;
};

export function create_resource_body_persist_counters(): ResourceBodyPersistCounters {
    return { css_index: 0, js_index: 0 };
}

export type PersistResourceBodiesResult = {
    body_unavailable_count: number;
    resource_too_large_count: number;
    counters: ResourceBodyPersistCounters;
};

/** Räknar kvarvarande kroppar som borde ha sparats efter alla persist-pass. */
export function count_body_capture_issues(
    state: NetworkCaptureState
): Pick<PersistResourceBodiesResult, 'body_unavailable_count' | 'resource_too_large_count'> {
    let body_unavailable_count = 0;
    let resource_too_large_count = 0;

    for (const resource of state.resources) {
        if (resource.bodyCaptured) continue;
        if (!is_resource_body_capture_candidate(resource)) {
            continue;
        }
        if (resource.bodySkipReason === 'resource exceeded size limit') {
            resource_too_large_count += 1;
            continue;
        }
        body_unavailable_count += 1;
    }

    return { body_unavailable_count, resource_too_large_count };
}

export async function persist_resource_bodies(
    cdp: CDPSession,
    state: NetworkCaptureState,
    temp_dir: string,
    counters: ResourceBodyPersistCounters = create_resource_body_persist_counters()
): Promise<PersistResourceBodiesResult> {
    await await_eager_resource_body_captures(state);

    const max_bytes = get_snapshot_resource_text_max_bytes();
    let css_index = counters.css_index;
    let js_index = counters.js_index;
    let body_unavailable_count = 0;
    let resource_too_large_count = 0;

    for (const resource of state.resources) {
        if (resource.bodyCaptured) continue;
        if (!is_resource_body_capture_candidate(resource)) {
            continue;
        }

        let raw: Buffer | null = resource.pendingBodyBytes;
        if (!raw) {
            if (resource.bodySkipReason === 'resource exceeded size limit') {
                resource_too_large_count += 1;
                continue;
            }
            if (resource.bodySkipReason) {
                body_unavailable_count += 1;
                continue;
            }
            try {
                const body_result = await cdp.send('Network.getResponseBody', {
                    requestId: resource.requestId,
                });
                raw = decode_cdp_response_body(body_result);
            } catch {
                resource.bodySkipReason = 'network response body no longer available';
                body_unavailable_count += 1;
                continue;
            }
        }

        if (raw.length > max_bytes) {
            resource.bodySkipReason = 'resource exceeded size limit';
            resource.pendingBodyBytes = null;
            resource_too_large_count += 1;
            continue;
        }

        const text = raw.toString('utf8');
        const mime = (resource.mimeType || '').toLowerCase();
        const is_css = mime.includes('css') || resource.resourceType === 'Stylesheet';
        const ext = is_css ? 'css' : 'js';
        const subdir = is_css ? 'resources/stylesheets' : 'resources/scripts';
        const filename = safe_resource_filename(is_css ? css_index++ : js_index++, ext);
        const rel = path.posix.join(subdir, filename);
        const full = path.join(temp_dir, rel);
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, text, 'utf8');
        resource.archiveRelativePath = rel;
        resource.bodyCaptured = true;
        resource.pendingBodyBytes = null;
    }

    return {
        body_unavailable_count,
        resource_too_large_count,
        counters: { css_index, js_index },
    };
}

export async function capture_extended_page_artifacts(
    page: Page,
    cdp: CDPSession,
    options: { should_yield: () => boolean }
): Promise<{
    rendered_html: string;
    accessibility_tree: unknown | null;
    dom_snapshot: unknown | null;
    mhtml: string | null;
    frames: FrameEntry[];
    warnings: SnapshotWarning[];
}> {
    const warnings: SnapshotWarning[] = [];
    const rendered_html = await page.content();

    let accessibility_tree: unknown | null = null;
    if (!options.should_yield()) {
        try {
            accessibility_tree = await cdp.send('Accessibility.getFullAXTree');
        } catch {
            warnings.push({ code: 'ax_unavailable', message: 'Accessibility tree unavailable' });
        }
    }

    let dom_snapshot: unknown | null = null;
    if (!options.should_yield()) {
        try {
            dom_snapshot = await cdp.send('DOMSnapshot.captureSnapshot', {
                computedStyles: [...DOM_SNAPSHOT_COMPUTED_STYLES],
            });
        } catch {
            warnings.push({ code: 'dom_snapshot_unavailable', message: 'DOM snapshot unavailable' });
        }
    }

    let mhtml: string | null = null;
    if (!options.should_yield()) {
        try {
            const result = await cdp.send('Page.captureSnapshot', { format: 'mhtml' });
            mhtml = result.data ?? null;
        } catch {
            warnings.push({ code: 'mhtml_unavailable', message: 'MHTML unavailable' });
        }
    }

    const frames: FrameEntry[] = [];
    try {
        const tree = await page.frames();
        for (const frame of tree) {
            frames.push({
                url: frame.url(),
                name: frame.name() || null,
                parentFrameId: frame.parentFrame()?.name() ?? null,
                isMainFrame: frame === page.mainFrame(),
            });
        }
    } catch {
        warnings.push({ code: 'frames_unavailable', message: 'Frame list unavailable' });
    }

    return { rendered_html, accessibility_tree, dom_snapshot, mhtml, frames, warnings };
}

export function to_network_json_entries(resources: PendingResource[]): NetworkResourceEntry[] {
    return resources.map((r) => ({
        url: r.url,
        method: r.method,
        resourceType: r.resourceType,
        mimeType: r.mimeType,
        status: r.status,
        timingMs: null,
        encodedSize: r.encodedSize,
        decodedSize: r.decodedSize,
        failed: r.failed,
        failureReason: r.failureReason,
        redirectChain: r.redirectChain,
        responseHeaders: r.responseHeaders,
        bodyCaptured: r.bodyCaptured,
        bodySkipReason: r.bodySkipReason,
        originalArchivePath: r.archiveRelativePath,
    }));
}

export function sha256_buffer(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

export function sha256_text(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
}
