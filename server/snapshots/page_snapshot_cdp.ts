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
};

export type NetworkCaptureState = {
    resources: PendingResource[];
    mainDocumentRequestId: string | null;
    mainDocumentBody: string | null;
};

export function create_network_capture_state(): NetworkCaptureState {
    return { resources: [], mainDocumentRequestId: null, mainDocumentBody: null };
}

export function is_resource_body_capture_candidate(
    resource: Pick<PendingResource, 'failed' | 'requestId' | 'mimeType' | 'resourceType'>,
    main_document_request_id: string | null
): boolean {
    if (resource.failed) return false;
    if (main_document_request_id && resource.requestId === main_document_request_id) {
        return true;
    }
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

export async function attach_network_listeners(
    cdp: CDPSession,
    state: NetworkCaptureState
): Promise<void> {
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
        };
        entry.url = event.request.url;
        entry.method = event.request.method;
        entry.resourceType = resource_type;
        if (!existing) state.resources.push(entry);
    });
    cdp.on('Network.responseReceived', (event: { requestId: string; response: { url: string; mimeType: string; status: number; headers: Record<string, string> } }) => {
        const entry = state.resources.find((r) => r.requestId === event.requestId);
        if (!entry) return;
        entry.mimeType = event.response.mimeType ?? null;
        entry.status = event.response.status;
        entry.responseHeaders = sanitize_response_headers(event.response.headers);
        if (entry.resourceType === 'Document') {
            state.mainDocumentRequestId = event.requestId;
        }
    });
    cdp.on('Network.loadingFinished', (event: { requestId: string; encodedDataLength: number }) => {
        const entry = state.resources.find((r) => r.requestId === event.requestId);
        if (!entry) return;
        entry.encodedSize = event.encodedDataLength;
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

export async function persist_resource_bodies(
    cdp: CDPSession,
    state: NetworkCaptureState,
    temp_dir: string,
    counters: ResourceBodyPersistCounters = create_resource_body_persist_counters()
): Promise<PersistResourceBodiesResult> {
    const max_bytes = get_snapshot_resource_text_max_bytes();
    let css_index = counters.css_index;
    let js_index = counters.js_index;
    let body_unavailable_count = 0;
    let resource_too_large_count = 0;

    for (const resource of state.resources) {
        if (resource.bodyCaptured) continue;
        if (!is_resource_body_capture_candidate(resource, state.mainDocumentRequestId)) {
            continue;
        }
        try {
            const body_result = await cdp.send('Network.getResponseBody', {
                requestId: resource.requestId,
            });
            const raw = body_result.base64Encoded
                ? Buffer.from(body_result.body, 'base64')
                : Buffer.from(body_result.body, 'utf8');
            if (raw.length > max_bytes) {
                resource.bodySkipReason = 'resource exceeded size limit';
                resource_too_large_count += 1;
                continue;
            }
            const text = raw.toString('utf8');
            if (resource.requestId === state.mainDocumentRequestId) {
                state.mainDocumentBody = text;
                resource.bodyCaptured = true;
                continue;
            }
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
        } catch {
            resource.bodySkipReason = 'network response body no longer available';
            body_unavailable_count += 1;
        }
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
                computedStyles: [
                    'display', 'visibility', 'color', 'background-color', 'font-size',
                    'font-weight', 'line-height', 'opacity', 'position', 'width', 'height',
                    'overflow', 'white-space', 'text-decoration', 'outline', 'content', 'transform',
                ],
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
