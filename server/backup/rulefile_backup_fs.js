/**
 * Läser regelfils-snapshots från backup-katalogens `_system`-område.
 *
 * Syfte: ge UI en lista och historik över regelfilsbackuper utan att blanda in
 * audit-backuperna (som ligger direkt under backup-katalogen).
 *
 * Snapshot-struktur skapas av `server/backup/system_backup.js`:
 *  - backup/_system/<YYYYMMDD_HHMMSS>/manifest.json
 *  - backup/_system/<YYYYMMDD_HHMMSS>/rulefiles/{published,drafts,working}/*.json
 */
import fs from 'fs/promises';
import path from 'path';
import { get_backup_dir } from './audit_backup.js';

const SYSTEM_DIRNAME = '_system';
const MANIFEST_FILENAME = 'manifest.json';
const SNAPSHOT_DIR_RE = /^\d{8}_\d{6}$/;

function is_safe_snapshot_dirname(name) {
    return typeof name === 'string' && SNAPSHOT_DIR_RE.test(name);
}

function ensure_safe_filename(filename) {
    const f = String(filename || '').trim();
    if (!f) return null;
    const decoded = decodeURIComponent(f);
    if (decoded.includes('..')) return null;
    if (path.normalize(decoded) !== decoded) return null;
    if (decoded.includes('/') || decoded.includes('\\')) return null;
    return decoded;
}

async function safe_read_json(file_path) {
    try {
        const raw = await fs.readFile(file_path, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function get_system_root_dir() {
    return path.join(get_backup_dir(), SYSTEM_DIRNAME);
}

export async function list_snapshot_dirnames() {
    let entries;
    try {
        entries = await fs.readdir(get_system_root_dir(), { withFileTypes: true });
    } catch (err) {
        if (err?.code === 'ENOENT') return [];
        throw err;
    }
    return entries
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter(is_safe_snapshot_dirname)
        .sort();
}

export async function read_snapshot_manifest(snapshot_dirname) {
    if (!is_safe_snapshot_dirname(snapshot_dirname)) return null;
    const manifest_path = path.join(get_system_root_dir(), snapshot_dirname, MANIFEST_FILENAME);
    return safe_read_json(manifest_path);
}

async function stat_file_maybe(fp) {
    try {
        return await fs.stat(fp);
    } catch {
        return null;
    }
}

/** Läser `metadata.version` från sparad regelfil-JSON (t.ex. 2025.2.r16). */
async function read_rulefile_metadata_version_json(file_path) {
    try {
        const raw = await fs.readFile(file_path, 'utf8');
        const data = JSON.parse(raw);
        const mv = data?.metadata?.version;
        if (mv === null || mv === undefined) return null;
        const s = String(mv).trim();
        return s || null;
    } catch {
        return null;
    }
}

function build_rulefile_paths(snapshot_dirname, category, filename) {
    const safe_file = ensure_safe_filename(filename);
    if (!safe_file) return null;
    const base = path.join(get_system_root_dir(), snapshot_dirname, 'rulefiles');
    const rel = category === 'published'
        ? path.join('published', safe_file)
        : category === 'drafts'
            ? path.join('drafts', safe_file)
            : category === 'working'
                ? path.join('working', safe_file)
                : null;
    if (!rel) return null;
    const full_path = path.join(base, rel);
    return { full_path, safe_file };
}

export async function list_rulefile_history_rows(rule_set_id) {
    const id = String(rule_set_id || '').trim();
    if (!id) return [];
    const snapshots = await list_snapshot_dirnames();
    const rows = [];

    for (const snapshot_dirname of snapshots) {
        const manifest = await read_snapshot_manifest(snapshot_dirname);
        const created_at = manifest?.created_at || null;
        const rules = Array.isArray(manifest?.rulefiles) ? manifest.rulefiles : [];
        const entry = rules.find((r) => String(r?.id || '') === id) || null;
        if (!entry?.filename) continue;

        const filename = String(entry.filename);
        for (const [category, folder] of [['published', 'published'], ['drafts', 'drafts'], ['working', 'working']]) {
            const paths = build_rulefile_paths(snapshot_dirname, category, filename);
            if (!paths) continue;
            const stat = await stat_file_maybe(paths.full_path);
            if (!stat || !stat.isFile()) continue;
            const metadata_version = await read_rulefile_metadata_version_json(paths.full_path);
            rows.push({
                snapshotDir: snapshot_dirname,
                createdAt: created_at,
                category: folder,
                filename: paths.safe_file,
                fileSizeBytes: typeof stat.size === 'number' ? stat.size : null,
                metadataVersion: metadata_version
            });
        }
    }

    return rows;
}

/**
 * Version (`metadata.version`) från den senaste backup-tidpunkten för regelfilen.
 */
function latest_metadata_version_from_history_rows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const times = rows.map((r) => (r.createdAt ? Date.parse(r.createdAt) || 0 : 0));
    const max_ts = Math.max(...times);
    if (!Number.isFinite(max_ts) || max_ts === 0) {
        const first = rows.map((r) => r.metadataVersion).find((v) => v != null && String(v).trim() !== '');
        return first != null ? String(first).trim() : null;
    }
    const at_max = rows.filter((r) => (r.createdAt ? Date.parse(r.createdAt) || 0 : 0) === max_ts);
    const ver = at_max.map((r) => r.metadataVersion).find((v) => v != null && String(v).trim() !== '');
    return ver != null ? String(ver).trim() : null;
}

export async function build_rulefile_overview_index() {
    const snapshots = await list_snapshot_dirnames();
    const by_id = new Map();

    for (const snapshot_dirname of snapshots) {
        const manifest = await read_snapshot_manifest(snapshot_dirname);
        if (!manifest || manifest.type !== 'system_snapshot') continue;
        const created_at = manifest.created_at || null;
        const rules = Array.isArray(manifest.rulefiles) ? manifest.rulefiles : [];

        for (const r of rules) {
            const id = String(r?.id || '').trim();
            if (!id) continue;
            const filename = String(r?.filename || '').trim();
            if (!filename) continue;

            const existing = by_id.get(id) || {
                ruleSetId: id,
                name: (r?.name || '').toString(),
                filename,
                latestSnapshotAt: null,
                backupFileCount: 0,
                has_published_in_any_snapshot: false,
                has_working_in_any_snapshot: false
            };

            existing.name = existing.name || (r?.name || '').toString();
            existing.filename = existing.filename || filename;
            if (!existing.latestSnapshotAt || (created_at && String(created_at) > String(existing.latestSnapshotAt))) {
                existing.latestSnapshotAt = created_at || existing.latestSnapshotAt;
            }
            if (r?.has_published) existing.has_published_in_any_snapshot = true;
            if ((r?.has_draft_changes === true) || (!r?.has_published && r?.has_draft)) existing.has_working_in_any_snapshot = true;

            by_id.set(id, existing);
        }
    }

    // Räkna faktiska filer på disk (per snapshot och kategori) så att UI-historiken stämmer.
    const results = [];
    for (const item of by_id.values()) {
        const rows = await list_rulefile_history_rows(item.ruleSetId);
        item.backupFileCount = rows.length;
        item.latestBackedMetadataVersion = latest_metadata_version_from_history_rows(rows);
        results.push(item);
    }

    results.sort((a, b) => String(b.latestSnapshotAt || '').localeCompare(String(a.latestSnapshotAt || '')));
    return results;
}

export function resolve_system_rulefile_file_path(snapshot_dirname, category, filename) {
    if (!is_safe_snapshot_dirname(snapshot_dirname)) return null;
    const cat = String(category || '').trim();
    if (cat !== 'published' && cat !== 'drafts' && cat !== 'working') return null;
    const paths = build_rulefile_paths(snapshot_dirname, cat, filename);
    if (!paths) return null;
    return paths.full_path;
}

