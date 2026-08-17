/**
 * Reserv: skickar färdig mobilnotis (title + message) via HA REST eller webhook med UTF-8.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

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
    Object.assign(env_cache, load_env_file(path.join(REPO_ROOT, '.env')));
    Object.assign(env_cache, load_env_file(get_ha_env_fallback_path()));
    const rule_path = path.join(REPO_ROOT, '.cursor', 'rules', 'nabu-webhook.local.mdc');
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
 * @returns {string | null}
 */
function read_webhook_url() {
    const from_env = process.env.NABU_WEBHOOK_URL?.trim();
    if (from_env) {
        return from_env;
    }
    const rule_path = path.join(REPO_ROOT, '.cursor', 'rules', 'nabu-webhook.local.mdc');
    if (!fs.existsSync(rule_path)) {
        return null;
    }
    for (const line of fs.readFileSync(rule_path, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (/^https:\/\/hooks\.nabu\.casa\/\S+$/.test(trimmed)) {
            return trimmed;
        }
    }
    return null;
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
 * @param {string} hooks_url
 * @returns {string[]}
 */
function resolve_webhook_targets(hooks_url) {
    const targets = [];
    const webhook_id_match = hooks_url.match(/hooks\.nabu\.casa\/(\S+)$/)
        || hooks_url.match(/\/api\/webhook\/(\S+)$/);
    const ha_base = load_env_value('HA_WEBHOOK_BASE_URL').replace(/\/$/, '');
    if (webhook_id_match && ha_base) {
        targets.push(`${ha_base}/api/webhook/${webhook_id_match[1]}`);
    }
    if (!targets.includes(hooks_url)) {
        targets.push(hooks_url);
    }
    return targets;
}

/**
 * @param {string} url
 * @param {string} body
 * @param {Record<string, string>} headers
 * @returns {boolean}
 */
function post_json(url, body, headers = {}) {
    const tmp = path.join(REPO_ROOT, '.cursor', `nabu_webhook_${Date.now()}.json`);
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.writeFileSync(tmp, body, 'utf8');
    try {
        const args = [
            '-s', '-S', '-f', '-m', '20',
            '-X', 'POST',
            '-H', 'Content-Type: application/json; charset=utf-8',
        ];
        for (const [key, value] of Object.entries(headers)) {
            args.push('-H', `${key}: ${value}`);
        }
        args.push('--data-binary', `@${tmp}`, url);
        const result = spawnSync('curl.exe', args, { encoding: 'utf8' });
        return result.status === 0;
    } finally {
        fs.rmSync(tmp, { force: true });
    }
}

/**
 * @param {{ title: string, message: string, projekt?: string, beskrivning?: string }} payload
 * @returns {boolean}
 */
async function try_ha_script_service(payload) {
    const ha_token = load_env_value('HA_TOKEN');
    const ha_urls = resolve_ha_urls();
    if (!ha_token || ha_urls.length === 0) {
        return false;
    }
    const body = JSON.stringify({
        title: payload.title,
        message: payload.message,
        projekt: payload.projekt ?? null,
        beskrivning: payload.beskrivning ?? null,
    });
    for (const ha_url of ha_urls) {
        const service_url = `${ha_url.replace(/\/$/, '')}/api/services/script/cursor_klar_notis`;
        if (post_json(service_url, body, { Authorization: `Bearer ${ha_token}` })) {
            console.log('[nabu_send_webhook_fallback] Script cursor_klar_notis anropat via HA REST.');
            return true;
        }
    }
    return false;
}

const payload_raw = process.argv[2];
if (!payload_raw?.trim()) {
    console.error('[nabu_send_webhook_fallback] Payload saknas.');
    process.exit(1);
}

/** @type {{ title: string, message: string, projekt?: string, beskrivning?: string }} */
const payload = JSON.parse(payload_raw);

if (await try_ha_script_service(payload)) {
    process.exit(0);
}

const hooks_url = read_webhook_url();
if (!hooks_url) {
    console.error('[nabu_send_webhook_fallback] Ingen webhook-URL.');
    process.exit(1);
}

const body = JSON.stringify({
    title: payload.title,
    message: payload.message,
    projekt: payload.projekt ?? null,
    beskrivning: payload.beskrivning ?? null,
});

for (const url of resolve_webhook_targets(hooks_url)) {
    if (post_json(url, body)) {
        console.log('[nabu_send_webhook_fallback] Webhook skickad med title och message.');
        process.exit(0);
    }
}

console.error('[nabu_send_webhook_fallback] Alla reservvägar misslyckades.');
process.exit(1);
