/**
 * @fileoverview Domän-cache för CMP-samtycke — endast skärmdumpsflödet.
 */

import fs from 'fs/promises';
import path from 'path';
import type { Page, CookieParam } from 'puppeteer';
import {
    CMP_CONSENT_LOCAL_STORAGE_KEYS,
    filter_cmp_cookies,
    filter_cmp_local_storage,
    get_registrable_domain,
    has_usable_consent_snapshot,
    merge_consent_snapshots,
    type ConsentCacheSnapshot,
    type ConsentSeedFile,
} from './page_screenshot_consent_cache_logic.js';

function get_cmp_consent_cache_dir(): string {
    const base = process.env.GV_CMP_CONSENT_CACHE_DIR || path.join(process.cwd(), 'cmp-consent-cache');
    return path.resolve(base);
}

function get_cmp_consent_seed_file_path(): string {
    const configured = process.env.GV_CMP_CONSENT_SEED_FILE;
    if (configured) {
        return path.resolve(configured);
    }
    return path.resolve(process.cwd(), 'server', 'data', 'cmp_consent_seed.json');
}

function get_domain_cache_file_path(domain: string): string {
    const safe_domain = domain.replace(/[^a-z0-9.-]/gi, '_');
    return path.join(get_cmp_consent_cache_dir(), `${safe_domain}.json`);
}

async function read_json_file<T>(file_path: string): Promise<T | null> {
    try {
        const raw = await fs.readFile(file_path, 'utf8');
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

async function load_seed_snapshot(domain: string): Promise<ConsentCacheSnapshot | null> {
    const seed = await read_json_file<ConsentSeedFile>(get_cmp_consent_seed_file_path());
    if (!seed || !seed[domain]) return null;
    const entry = seed[domain];
    return {
        domain,
        updated_at: entry.updated_at || new Date(0).toISOString(),
        source: entry.source || 'manual',
        cookies: entry.cookies || [],
        local_storage: entry.local_storage || {},
    };
}

async function load_auto_cache_snapshot(domain: string): Promise<ConsentCacheSnapshot | null> {
    return read_json_file<ConsentCacheSnapshot>(get_domain_cache_file_path(domain));
}

/**
 * Laddar seed + auto-cache för domänen (merge, nyare updated_at vinner per fält).
 */
export async function load_consent_for_domain(url: string): Promise<ConsentCacheSnapshot | null> {
    const domain = get_registrable_domain(url);
    const seed = await load_seed_snapshot(domain);
    const cached = await load_auto_cache_snapshot(domain);

    if (!seed && !cached) {
        return null;
    }
    if (!seed) {
        return has_usable_consent_snapshot(cached) ? cached : null;
    }
    if (!cached) {
        return has_usable_consent_snapshot(seed) ? seed : null;
    }

    const merged = merge_consent_snapshots(seed, cached);
    return has_usable_consent_snapshot(merged) ? merged : null;
}

/**
 * Sätter cachade CMP-cookies före navigering.
 */
export async function apply_consent_cookies(
    page: Page,
    snapshot: ConsentCacheSnapshot | null
): Promise<boolean> {
    if (!has_usable_consent_snapshot(snapshot) || !snapshot || snapshot.cookies.length === 0) {
        return false;
    }

    const cookies: CookieParam[] = snapshot.cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || `.${snapshot.domain}`,
        path: cookie.path || '/',
    }));
    await page.setCookie(...cookies);
    return true;
}

/**
 * Injicerar cachad localStorage efter navigering (samma origin krävs).
 */
export async function apply_consent_local_storage(
    page: Page,
    snapshot: ConsentCacheSnapshot | null
): Promise<boolean> {
    if (!has_usable_consent_snapshot(snapshot) || !snapshot) return false;
    const keys = Object.keys(snapshot.local_storage);
    if (keys.length === 0) return false;

    await page.evaluate((storage_keys, storage_values) => {
        for (const key of storage_keys) {
            const value = storage_values[key];
            if (typeof value === 'string' && value.length > 0) {
                window.localStorage.setItem(key, value);
            }
        }
    }, keys, snapshot.local_storage);
    return true;
}

/**
 * Sparar CMP-samtycke efter lyckad banner-dismiss.
 */
export async function learn_consent_from_page(page: Page, url: string): Promise<void> {
    const domain = get_registrable_domain(url);
    const raw_cookies = await page.cookies();
    const cookies = filter_cmp_cookies(raw_cookies);
    const storage_keys = [...CMP_CONSENT_LOCAL_STORAGE_KEYS];
    const local_storage = filter_cmp_local_storage(
        await page.evaluate((keys) => {
            const result: Record<string, string> = {};
            for (const key of keys) {
                const value = window.localStorage.getItem(key);
                if (value) {
                    result[key] = value;
                }
            }
            return result;
        }, storage_keys)
    );

    if (cookies.length === 0 && Object.keys(local_storage).length === 0) {
        return;
    }

    const learned: ConsentCacheSnapshot = {
        domain,
        updated_at: new Date().toISOString(),
        source: 'learned',
        cookies,
        local_storage,
    };

    const existing = await load_auto_cache_snapshot(domain);
    const merged = merge_consent_snapshots(existing, learned);
    const dir = get_cmp_consent_cache_dir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(get_domain_cache_file_path(domain), `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}
