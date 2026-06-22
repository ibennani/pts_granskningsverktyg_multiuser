/**
 * @fileoverview Kö för uppskjuten radering av mediefiler på servern (vid offline-borttagning).
 */

import { delete_audit_media } from '../api/audit_media_api.js';
import { is_browser_online } from '../utils/browser_online.js';
import { mark_audit_sync_pending } from '../logic/connectivity_service.js';
import { revoke_audit_media_blob_url } from '../components/media/render_audit_media_list_item.js';
import { filenames_safe_to_delete_from_server } from '../logic/audit_attached_media_references.js';

const STORAGE_KEY = 'gv_pending_audit_media_deletes';

type PendingDeletesMap = Record<string, string[]>;

function read_map(): PendingDeletesMap {
    if (typeof sessionStorage === 'undefined') return {};
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as PendingDeletesMap;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function write_map(map: PendingDeletesMap): void {
    if (typeof sessionStorage === 'undefined') return;
    const keys = Object.keys(map);
    if (keys.length === 0) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Lägger till filnamn i kön för senare serverradering.
 */
export function enqueue_pending_media_deletes(audit_id: string, filenames: string[]): void {
    const id = String(audit_id || '').trim();
    if (!id || filenames.length === 0) return;

    const map = read_map();
    const existing = new Set(map[id] || []);
    filenames.forEach((name) => {
        const trimmed = String(name || '').trim();
        if (trimmed) existing.add(trimmed);
    });
    map[id] = [...existing];
    write_map(map);
}

function remove_from_queue(audit_id: string, deleted: string[]): void {
    const id = String(audit_id || '').trim();
    if (!id || deleted.length === 0) return;
    const map = read_map();
    const remaining = (map[id] || []).filter((name) => !deleted.includes(name));
    if (remaining.length === 0) {
        delete map[id];
    } else {
        map[id] = remaining;
    }
    write_map(map);
}

/**
 * Försöker radera köade filer på servern om de fortfarande inte refereras.
 */
export async function flush_pending_media_deletes_for_audit(
    audit_id: string,
    get_still_referenced: () => Set<string>
): Promise<void> {
    const id = String(audit_id || '').trim();
    if (!id || !is_browser_online()) return;

    const map = read_map();
    const queued = map[id];
    if (!queued || queued.length === 0) return;

    const still_referenced = get_still_referenced();
    const to_delete = filenames_safe_to_delete_from_server(queued, still_referenced);
    const deleted: string[] = [];

    for (const filename of to_delete) {
        try {
            await delete_audit_media(id, filename);
            revoke_audit_media_blob_url(id, filename);
            deleted.push(filename);
        } catch {
            mark_audit_sync_pending();
        }
    }

    if (deleted.length > 0) {
        remove_from_queue(id, deleted);
    }
}

/**
 * Flush för aktuell granskning från connectivity-tjänsten.
 */
export async function flush_pending_media_deletes_for_state(
    state: { auditId?: string | null } | null | undefined,
    collect_referenced: (s: typeof state) => Set<string>
): Promise<void> {
    const audit_id = state?.auditId;
    if (!audit_id) return;
    await flush_pending_media_deletes_for_audit(String(audit_id), () => collect_referenced(state));
}
