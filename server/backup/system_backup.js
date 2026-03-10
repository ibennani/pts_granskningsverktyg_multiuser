/**
 * System-snapshot till backup-katalogen.
 *
 * Sparar regelfiler (publicerade + utkast/arbetskopior) och användardata till fil på servern.
 * Ingen UI-logik – detta är en ren serverside-backup för framtida återställning.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../db.js';

const SYSTEM_DIRNAME = '_system';
const MANIFEST_FILENAME = 'manifest.json';

function pad2(n) {
    return String(n).padStart(2, '0');
}

function format_snapshot_dirname(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${y}${m}${day}_${hh}${mm}${ss}`;
}

async function ensure_dir(dir_path) {
    try {
        await fs.mkdir(dir_path, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

function normalize_to_safe_filename_base(value) {
    const raw = typeof value === 'string' ? value : '';
    const normalized = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_.-]/g, '');

    // Windows-otillåtna tecken + kontrolltecken
    const no_reserved = normalized.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');
    const trimmed = no_reserved.replace(/^_+|_+$/g, '');
    return trimmed || 'regelfil';
}

function ensure_json_suffix(filename) {
    const f = String(filename || '').trim();
    if (!f) return 'regelfil.json';
    return f.toLowerCase().endsWith('.json') ? f : `${f}.json`;
}

function stable_stringify(value) {
    const seen = new WeakSet();
    const sorter = (v) => {
        if (v === null || v === undefined) return v;
        if (typeof v !== 'object') return v;
        if (seen.has(v)) return null;
        seen.add(v);
        if (Array.isArray(v)) return v.map(sorter);
        const keys = Object.keys(v).sort();
        const out = {};
        keys.forEach((k) => {
            out[k] = sorter(v[k]);
        });
        return out;
    };
    return JSON.stringify(sorter(value));
}

function sha256_hex(str) {
    return crypto.createHash('sha256').update(String(str), 'utf8').digest('hex');
}

async function safe_write_json_atomic(target_path, data) {
    const tmp_path = `${target_path}.tmp`;
    await fs.writeFile(tmp_path, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp_path, target_path);
}

async function read_latest_manifest(system_root_dir) {
    let entries;
    try {
        entries = await fs.readdir(system_root_dir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
    }

    const dirs = entries
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((name) => typeof name === 'string' && /^\d{8}_\d{6}$/.test(name))
        .sort()
        .reverse();

    for (const dirname of dirs) {
        const manifest_path = path.join(system_root_dir, dirname, MANIFEST_FILENAME);
        try {
            const content = await fs.readFile(manifest_path, 'utf8');
            return JSON.parse(content);
        } catch {
            // Ignorera och fortsätt bakåt tills vi hittar en läsbar manifest.
        }
    }
    return null;
}

function parse_jsonb_maybe(value) {
    if (value == null) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
    return null;
}

async function fetch_rule_sets_for_snapshot() {
    const result = await query(
        `SELECT id, name, content, published_content, version, created_at, updated_at, production_base_id
           FROM rule_sets
           ORDER BY updated_at DESC, created_at DESC`,
        []
    );
    return result.rows || [];
}

async function fetch_users_for_snapshot() {
    const result = await query(
        `SELECT id, username, name, is_admin, created_at,
                language_preference, theme_preference, review_sort_preference, password
           FROM users
           ORDER BY created_at ASC`,
        []
    );
    return result.rows || [];
}

async function fetch_password_reset_tokens_for_snapshot() {
    const result = await query(
        `SELECT id, user_id, code_hash, expires_at, used_at, created_at
           FROM password_reset_tokens
           ORDER BY created_at ASC`,
        []
    );
    return result.rows || [];
}

function build_rulefile_filename_map(rule_rows) {
    const taken = new Map(); // filename -> id
    const out = new Map(); // rule_set_id -> filename

    for (const row of rule_rows) {
        const id = row?.id ? String(row.id) : '';
        const name = row?.name ? String(row.name) : '';
        let base = normalize_to_safe_filename_base(name);
        base = ensure_json_suffix(base).replace(/\.json$/i, '');

        let filename = ensure_json_suffix(base);
        const existing_id = taken.get(filename);
        if (existing_id && existing_id !== id) {
            const short_id = id ? id.slice(0, 8) : crypto.randomBytes(4).toString('hex');
            filename = ensure_json_suffix(`${base}__${short_id}`);
        }
        taken.set(filename, id);
        out.set(id, filename);
    }
    return out;
}

export async function save_system_snapshot({ backup_dir, now = new Date(), retention_days = 30 } = {}) {
    const base = path.resolve(backup_dir || process.cwd());
    const system_root_dir = path.join(base, SYSTEM_DIRNAME);
    await ensure_dir(system_root_dir);

    const [rule_rows, user_rows, token_rows] = await Promise.all([
        fetch_rule_sets_for_snapshot(),
        fetch_users_for_snapshot(),
        fetch_password_reset_tokens_for_snapshot()
    ]);

    const rule_snapshot_rows = rule_rows.map((r) => ({
        id: r.id,
        name: r.name,
        version: r.version,
        created_at: r.created_at,
        updated_at: r.updated_at,
        production_base_id: r.production_base_id || null,
        has_published: r.published_content != null,
        published_content: parse_jsonb_maybe(r.published_content),
        draft_content: parse_jsonb_maybe(r.content)
    }));

    const system_data_for_hash = {
        rule_sets: rule_snapshot_rows.map((r) => ({
            id: r.id,
            name: r.name,
            version: r.version,
            production_base_id: r.production_base_id,
            published_content: r.published_content,
            draft_content: r.draft_content
        })),
        users: user_rows,
        password_reset_tokens: token_rows
    };

    const content_hash = sha256_hex(stable_stringify(system_data_for_hash));
    const latest_manifest = await read_latest_manifest(system_root_dir);
    if (latest_manifest?.content_hash && latest_manifest.content_hash === content_hash) {
        return {
            did_write: false,
            reason: 'no_changes',
            content_hash
        };
    }

    const snapshot_dirname = format_snapshot_dirname(now);
    const snapshot_root = path.join(system_root_dir, snapshot_dirname);

    const rulefiles_published_dir = path.join(snapshot_root, 'rulefiles', 'published');
    const rulefiles_drafts_dir = path.join(snapshot_root, 'rulefiles', 'drafts');
    const rulefiles_working_dir = path.join(snapshot_root, 'rulefiles', 'working');
    const users_dir = path.join(snapshot_root, 'users');

    await Promise.all([
        ensure_dir(rulefiles_published_dir),
        ensure_dir(rulefiles_drafts_dir),
        ensure_dir(rulefiles_working_dir),
        ensure_dir(users_dir)
    ]);

    const filename_by_id = build_rulefile_filename_map(rule_rows);

    let published_count = 0;
    let draft_count = 0;
    let working_count = 0;

    const rulefile_index = [];

    for (const row of rule_rows) {
        const id = row?.id ? String(row.id) : '';
        const filename = filename_by_id.get(id) || ensure_json_suffix(`regelfil_${id || 'okand'}`);

        const published = parse_jsonb_maybe(row?.published_content);
        const draft = parse_jsonb_maybe(row?.content);

        const has_published = published != null;
        const has_draft = draft != null;
        const draft_differs = has_published && has_draft
            ? stable_stringify(published) !== stable_stringify(draft)
            : false;

        if (has_published) {
            const out_path = path.join(rulefiles_published_dir, filename);
            await safe_write_json_atomic(out_path, published);
            published_count += 1;
        }

        if (has_published && draft_differs) {
            const out_path = path.join(rulefiles_drafts_dir, filename);
            await safe_write_json_atomic(out_path, draft);
            draft_count += 1;
        }

        if (!has_published && has_draft) {
            const out_path = path.join(rulefiles_working_dir, filename);
            await safe_write_json_atomic(out_path, draft);
            working_count += 1;
        }

        rulefile_index.push({
            id,
            name: row?.name || '',
            filename,
            version: row?.version ?? null,
            production_base_id: row?.production_base_id || null,
            has_published,
            has_draft,
            has_draft_changes: draft_differs
        });
    }

    await safe_write_json_atomic(path.join(users_dir, 'users.json'), user_rows);
    await safe_write_json_atomic(path.join(users_dir, 'password_reset_tokens.json'), token_rows);

    const manifest = {
        type: 'system_snapshot',
        created_at: new Date(now).toISOString(),
        retention_days: retention_days,
        content_hash,
        counts: {
            rule_sets_total: rule_rows.length,
            rulefiles_published: published_count,
            rulefiles_drafts: draft_count,
            rulefiles_working: working_count,
            users: user_rows.length,
            password_reset_tokens: token_rows.length
        },
        rulefiles: rulefile_index
    };

    await safe_write_json_atomic(path.join(snapshot_root, MANIFEST_FILENAME), manifest);

    return {
        did_write: true,
        snapshot_dirname,
        snapshot_root,
        content_hash,
        counts: manifest.counts
    };
}

export async function cleanup_old_system_snapshots({ backup_dir, retention_days = 30 } = {}) {
    const base = path.resolve(backup_dir || process.cwd());
    const system_root_dir = path.join(base, SYSTEM_DIRNAME);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retention_days);
    const cutoff_time = cutoff.getTime();

    let entries;
    try {
        entries = await fs.readdir(system_root_dir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') return 0;
        throw err;
    }

    const dirs = entries
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((name) => typeof name === 'string' && name.length > 0);

    let removed = 0;
    for (const dirname of dirs) {
        const dir_path = path.join(system_root_dir, dirname);
        try {
            const stat = await fs.stat(dir_path);
            if (stat.mtimeMs < cutoff_time) {
                await fs.rm(dir_path, { recursive: true, force: true });
                removed += 1;
            }
        } catch {
            // Ignorera
        }
    }
    return removed;
}

