/**
 * Skickar Home Assistant-event cursor_agent_klar (mobilnotis).
 * Delad mellan hooks, notify_done och nabu_send_webhook.ps1 (via CLI).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const GENERIC_BESKRIVNING = 'Öppna Cursor och läs senaste svaret.';

/** @type {Record<string, string> | null} */
let env_cache = null;

function get_ha_env_fallback_path() {
    const kod_root = path.resolve(REPO_ROOT, '..', '..');
    return path.join(kod_root, 'home_assistant', '.env');
}

function load_env_file(pathname) {
    /** @type {Record<string, string>} */
    const result = {};
    if (!fs.existsSync(pathname)) {
        return result;
    }
    for (const line of fs.readFileSync(pathname, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const eq = trimmed.indexOf('=');
        if (eq <= 0) {
            continue;
        }
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}

function load_all_env() {
    if (env_cache) {
        return env_cache;
    }
    env_cache = {};
    const local_env = path.join(REPO_ROOT, '.env');
    const rule_path = path.join(REPO_ROOT, '.cursor', 'rules', 'nabu-webhook.local.mdc');
    Object.assign(env_cache, load_env_file(local_env));
    Object.assign(env_cache, load_env_file(get_ha_env_fallback_path()));
    if (fs.existsSync(rule_path)) {
        for (const line of fs.readFileSync(rule_path, 'utf8').split(/\r?\n/)) {
            const t = line.trim();
            const m = t.match(/^HA_WEBHOOK_BASE_URL=(\S+)$/);
            if (m) {
                env_cache.HA_WEBHOOK_BASE_URL = m[1];
            }
            const url_match = t.match(/^(https:\/\/[a-z0-9]+\.ui\.nabu\.casa)$/);
            if (url_match) {
                env_cache.HA_WEBHOOK_BASE_URL = url_match[1];
            }
        }
    }
    return env_cache;
}

/**
 * @param {string} key
 * @returns {string}
 */
function load_env_value(key) {
    const from_process = process.env[key]?.trim();
    if (from_process) {
        return from_process;
    }
    return load_all_env()[key]?.trim() || '';
}

/**
 * @returns {string[]}
 */
function resolve_ha_urls() {
    const urls = [];
    for (const key of ['HA_URL_REMOTE', 'HA_URL']) {
        const value = load_env_value(key);
        if (value && !urls.includes(value.replace(/\/$/, ''))) {
            urls.push(value.replace(/\/$/, ''));
        }
    }
    const ha_base = load_env_value('HA_WEBHOOK_BASE_URL').replace(/\/$/, '');
    if (ha_base && !urls.includes(ha_base)) {
        urls.push(ha_base);
    }
    return urls;
}

/**
 * @param {string} beskrivning
 * @returns {boolean}
 */
export function should_skip_beskrivning(beskrivning) {
    const trimmed = beskrivning.trim();
    return trimmed.length === 0 || trimmed === GENERIC_BESKRIVNING;
}

/**
 * @param {string} ha_url
 * @param {string} ha_token
 * @param {string} beskrivning
 */
async function post_ha_event(ha_url, ha_token, beskrivning) {
    const url = `${ha_url.replace(/\/$/, '')}/api/events/cursor_agent_klar`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ha_token}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ beskrivning }),
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}

/**
 * @param {string} beskrivning
 * @returns {Promise<boolean>}
 */
export async function send_cursor_agent_klar_event(beskrivning) {
    if (should_skip_beskrivning(beskrivning)) {
        return false;
    }
    const ha_token = load_env_value('HA_TOKEN');
    const ha_urls = resolve_ha_urls();
    if (!ha_token || ha_urls.length === 0) {
        console.error('[nabu_ha_cursor_klar_event] HA_TOKEN eller HA_URL saknas.');
        return false;
    }
    for (const ha_url of ha_urls) {
        try {
            await post_ha_event(ha_url, ha_token, beskrivning.trim());
            return true;
        } catch {
            // Försök nästa URL.
        }
    }
    console.error('[nabu_ha_cursor_klar_event] Kunde inte skicka cursor_agent_klar.');
    return false;
}

const is_main = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (is_main) {
    const beskrivning = process.argv.slice(2).join(' ').trim();
    const sent = await send_cursor_agent_klar_event(beskrivning);
    process.exit(sent ? 0 : 1);
}
