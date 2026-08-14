/**
 * @fileoverview Domän-cache för overlay-dismiss — endast skärmdumpsflödet.
 */

import fs from 'fs/promises';
import path from 'path';
import {
    get_registrable_domain,
    has_usable_overlay_hint_snapshot,
    merge_overlay_domain_hints,
    merge_overlay_hint_snapshots,
    overlay_hints_from_dismiss_result,
    sanitize_overlay_domain_hints,
    type OverlayDismissLearnedHint,
    type OverlayDomainHints,
    type OverlayHintCacheSnapshot,
    type OverlayHintSeedFile,
} from './page_screenshot_intrusive_overlay_cache_logic.js';

function get_overlay_hint_cache_dir(): string {
    const base = process.env.GV_INTRUSIVE_OVERLAY_CACHE_DIR
        || path.join(process.cwd(), 'intrusive-overlay-cache');
    return path.resolve(base);
}

function get_overlay_hint_seed_file_path(): string {
    const configured = process.env.GV_INTRUSIVE_OVERLAY_SEED_FILE;
    if (configured) {
        return path.resolve(configured);
    }
    return path.resolve(process.cwd(), 'server', 'data', 'intrusive_overlay_seed.json');
}

function get_domain_cache_file_path(domain: string): string {
    const safe_domain = domain.replace(/[^a-z0-9.-]/gi, '_');
    return path.join(get_overlay_hint_cache_dir(), `${safe_domain}.json`);
}

async function read_json_file<T>(file_path: string): Promise<T | null> {
    try {
        const raw = await fs.readFile(file_path, 'utf8');
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

async function load_seed_snapshot(domain: string): Promise<OverlayHintCacheSnapshot | null> {
    const seed = await read_json_file<OverlayHintSeedFile>(get_overlay_hint_seed_file_path());
    if (!seed || !seed[domain]) return null;
    const entry = seed[domain];
    return {
        domain,
        updated_at: entry.updated_at || new Date(0).toISOString(),
        source: entry.source || 'manual',
        hints: sanitize_overlay_domain_hints(entry.hints),
    };
}

async function load_auto_cache_snapshot(domain: string): Promise<OverlayHintCacheSnapshot | null> {
    return read_json_file<OverlayHintCacheSnapshot>(get_domain_cache_file_path(domain));
}

/**
 * Laddar seed + auto-cache för domänen (merge, nyare updated_at vinner per fält).
 */
export async function load_overlay_hints_for_domain(url: string): Promise<OverlayDomainHints | null> {
    const domain = get_registrable_domain(url);
    const seed = await load_seed_snapshot(domain);
    const cached = await load_auto_cache_snapshot(domain);

    if (!seed && !cached) {
        return null;
    }
    if (!seed) {
        return has_usable_overlay_hint_snapshot(cached) ? sanitize_overlay_domain_hints(cached?.hints) : null;
    }
    if (!cached) {
        return has_usable_overlay_hint_snapshot(seed) ? sanitize_overlay_domain_hints(seed.hints) : null;
    }

    const merged = merge_overlay_hint_snapshots(seed, cached);
    return has_usable_overlay_hint_snapshot(merged) ? sanitize_overlay_domain_hints(merged.hints) : null;
}

/**
 * Sparar overlay-hint efter lyckad dismiss.
 */
export async function learn_overlay_hints_from_dismiss(
    url: string,
    hint: OverlayDismissLearnedHint | null | undefined
): Promise<void> {
    const domain = get_registrable_domain(url);
    const learned_hints = overlay_hints_from_dismiss_result(hint);
    if (!learned_hints) return;

    const learned: OverlayHintCacheSnapshot = {
        domain,
        updated_at: new Date().toISOString(),
        source: 'learned',
        hints: learned_hints,
    };

    const existing = await load_auto_cache_snapshot(domain);
    const merged = merge_overlay_hint_snapshots(existing, learned);
    const dir = get_overlay_hint_cache_dir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(get_domain_cache_file_path(domain), `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

export function merge_loaded_hints_with_base<T extends { close_selectors: string[]; shadow_host_selectors: string[] }>(
    base: T,
    domain_hints: OverlayDomainHints | null
): T {
    if (!domain_hints) return base;
    const merged = merge_overlay_domain_hints(null, domain_hints);
    return {
        ...base,
        close_selectors: [
            ...(merged.close_selectors || []),
            ...base.close_selectors,
        ],
        shadow_host_selectors: [
            ...(merged.shadow_host_selectors || []),
            ...base.shadow_host_selectors,
        ],
    };
}
