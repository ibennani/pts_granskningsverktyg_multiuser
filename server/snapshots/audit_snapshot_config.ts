/**
 * @fileoverview Miljökonfiguration för tekniska snapshots.
 */
import { FILE_MAX_BYTES } from '../../shared/constants/file_size_limits.js';

function read_int_env(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function read_bool_env(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

export function get_snapshot_browser_max_concurrency(): number {
    const legacy = process.env.GV_SNAPSHOT_MAX_CONCURRENCY;
    if (legacy !== undefined && legacy !== '') {
        return read_int_env('GV_SNAPSHOT_MAX_CONCURRENCY', 4);
    }
    return read_int_env('GV_SNAPSHOT_BROWSER_MAX_CONCURRENCY', 4);
}

export function get_snapshot_package_max_concurrency(): number {
    return read_int_env('GV_SNAPSHOT_PACKAGE_MAX_CONCURRENCY', 3);
}

export function get_snapshot_extended_cdp_max_ms(): number {
    return read_int_env('GV_SNAPSHOT_EXTENDED_CDP_MAX_MS', 8000);
}

export function get_snapshot_yield_on_queue(): boolean {
    return read_bool_env('GV_SNAPSHOT_YIELD_ON_QUEUE', true);
}

export function get_snapshot_max_bytes(): number {
    return read_int_env('GV_SNAPSHOT_MAX_BYTES', FILE_MAX_BYTES);
}

export function get_snapshot_resource_text_max_bytes(): number {
    return read_int_env('GV_SNAPSHOT_RESOURCE_TEXT_MAX_BYTES', 2 * 1024 * 1024);
}

export function get_snapshot_host_max_concurrency(): number {
    return read_int_env('GV_SNAPSHOT_HOST_MAX_CONCURRENCY', 1);
}

export function get_snapshot_host_cooldown_ms(): number {
    return read_int_env('GV_SNAPSHOT_HOST_COOLDOWN_MS', 3000);
}

export function get_snapshot_network_buffer_per_resource(): number {
    return read_int_env('GV_SNAPSHOT_NETWORK_BUFFER_PER_RESOURCE', 5 * 1024 * 1024);
}

export function get_snapshot_network_buffer_total(): number {
    return read_int_env('GV_SNAPSHOT_NETWORK_BUFFER_TOTAL', 50 * 1024 * 1024);
}

export function get_snapshot_post_navigation_settle_ms(): number {
    return read_int_env('GV_SNAPSHOT_POST_NAVIGATION_SETTLE_MS', 1500);
}

export function get_snapshot_full_page_max_height_css(): number {
    return read_int_env('GV_SNAPSHOT_FULL_PAGE_MAX_HEIGHT_CSS', 50_000);
}
