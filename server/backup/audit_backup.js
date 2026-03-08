/**
 * Schemalagd backup av granskningar till JSON-filer.
 * Schema styrs av first_run_hour, last_run_hour och runs_per_day (jämnt fördelat). Sparar endast vid ändringar, rensar filer enligt retention_days.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { query } from '../db.js';
import { build_full_state } from '../routes/audits.js';
import { generate_audit_filename } from '../../js/utils/filename_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_RUNS_PER_DAY = 4;
const DEFAULT_FIRST_RUN_HOUR = 0;
const DEFAULT_LAST_RUN_HOUR = 18;
const SETTINGS_FILENAME = '.backup-settings.json';
const ALLOWED_RUNS_PER_DAY = [1, 2, 3, 4, 6, 8, 12, 24];

function get_settings_path() {
    return path.join(get_backup_dir(), SETTINGS_FILENAME);
}

function clamp_runs_per_day(n) {
    const num = typeof n === 'number' ? n : parseInt(n, 10);
    if (!Number.isInteger(num) || num < 1 || num > 24) return DEFAULT_RUNS_PER_DAY;
    return ALLOWED_RUNS_PER_DAY.includes(num) ? num : DEFAULT_RUNS_PER_DAY;
}

function clamp_hour(n) {
    const num = typeof n === 'number' ? n : parseInt(n, 10);
    if (!Number.isInteger(num) || num < 0 || num > 23) return 0;
    return num;
}

/**
 * Beräknar vilka timmar backup körs, jämnt fördelat mellan first och last (inkl. midnatt).
 */
function compute_schedule_hours(first_run_hour, last_run_hour, runs_per_day) {
    const first = clamp_hour(first_run_hour);
    const last = clamp_hour(last_run_hour);
    const runs = clamp_runs_per_day(runs_per_day);
    if (runs === 1) return [first];
    const span = last >= first ? last - first : 24 - first + last;
    const hours = [];
    for (let i = 0; i < runs; i++) {
        const h = Math.round((first + (i * span) / (runs - 1)) % 24);
        hours.push(h);
    }
    const uniq = [...new Set(hours)].sort((a, b) => a - b);
    return uniq;
}

/**
 * Bygger cron-uttryck från first_run_hour, last_run_hour och runs_per_day.
 */
export function build_cron_from_settings(settings) {
    const hours = compute_schedule_hours(
        settings?.first_run_hour ?? DEFAULT_FIRST_RUN_HOUR,
        settings?.last_run_hour ?? DEFAULT_LAST_RUN_HOUR,
        settings?.runs_per_day
    );
    return `0 ${hours.join(',')} * * *`;
}

export async function get_backup_settings() {
    let retention_days = DEFAULT_RETENTION_DAYS;
    let runs_per_day = DEFAULT_RUNS_PER_DAY;
    let first_run_hour = DEFAULT_FIRST_RUN_HOUR;
    let last_run_hour = DEFAULT_LAST_RUN_HOUR;
    try {
        const content = await fs.readFile(get_settings_path(), 'utf8');
        const data = JSON.parse(content);
        if (typeof data.retention_days === 'number' && data.retention_days >= 1 && data.retention_days <= 365) {
            retention_days = data.retention_days;
        }
        if (data.runs_per_day != null) runs_per_day = clamp_runs_per_day(data.runs_per_day);
        if (data.first_run_hour != null) first_run_hour = clamp_hour(data.first_run_hour);
        if (data.last_run_hour != null) last_run_hour = clamp_hour(data.last_run_hour);
    } catch {
        /* använd standardvärden */
    }
    const schedule_cron = build_cron_from_settings({ runs_per_day, first_run_hour, last_run_hour });
    return { retention_days, runs_per_day, first_run_hour, last_run_hour, schedule_cron };
}

export async function save_backup_settings(settings) {
    const current = await get_backup_settings();
    const next = {
        retention_days: typeof settings.retention_days === 'number' && settings.retention_days >= 1 && settings.retention_days <= 365
            ? settings.retention_days
            : current.retention_days,
        runs_per_day: settings.runs_per_day != null ? clamp_runs_per_day(settings.runs_per_day) : current.runs_per_day,
        first_run_hour: settings.first_run_hour != null ? clamp_hour(settings.first_run_hour) : current.first_run_hour,
        last_run_hour: settings.last_run_hour != null ? clamp_hour(settings.last_run_hour) : current.last_run_hour
    };
    const dir = get_backup_dir();
    try {
        await ensure_dir(dir);
    } catch (e) {
        const err = new Error(`Kunde inte skapa backup-katalog: ${dir}. ${e.message}`);
        err.code = e.code;
        throw err;
    }
    const file_path = path.join(dir, SETTINGS_FILENAME);
    const tmp_path = file_path + '.tmp';
    try {
        await fs.writeFile(tmp_path, JSON.stringify(next, null, 2), 'utf8');
        await fs.rename(tmp_path, file_path);
    } catch (e) {
        const err = new Error(`Kunde inte skriva inställningsfil: ${e.message}`);
        err.code = e.code;
        throw err;
    }
    return next;
}

const SERVER_T_KEYS = {
    filename_audit_prefix: 'tillganglighetsgranskning',
    filename_fallback_actor: 'granskning',
    filename_archive_suffix: 'arkiv',
    filename_locked_suffix: 'granskningen_låst',
    filename_manual_save_suffix: 'manuellt_sparad'
};

function server_t_func(key) {
    return SERVER_T_KEYS[key] ?? key;
}

export function get_backup_dir() {
    const base = process.env.GV_BACKUP_DIR || path.join(process.cwd(), 'backup');
    return path.resolve(base);
}

function hash_content(data) {
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
}

async function ensure_dir(dir_path) {
    try {
        await fs.mkdir(dir_path, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

async function run_scheduled_backup() {
    const backup_dir = get_backup_dir();
    await ensure_dir(backup_dir);

    const result = await query(
        `SELECT * FROM audits WHERE status != 'locked' ORDER BY updated_at DESC`
    );

    let new_files = 0;
    const start_time = new Date().toISOString();

    for (const audit_row of result.rows) {
        try {
            let rule_set_row = null;
            if (audit_row.rule_set_id) {
                const rs = await query('SELECT * FROM rule_sets WHERE id = $1', [audit_row.rule_set_id]);
                rule_set_row = rs.rows[0] || null;
            }
            const full_state = build_full_state(audit_row, rule_set_row);
            const current_hash = hash_content(full_state);

            const audit_dir = path.join(backup_dir, audit_row.id);
            await ensure_dir(audit_dir);

            let existing_files = [];
            try {
                existing_files = await fs.readdir(audit_dir);
            } catch {
                // Mappen tom eller saknas
            }

            const json_files = existing_files.filter(f => f.endsWith('.json')).sort().reverse();
            let skip = false;
            if (json_files.length > 0) {
                const latest = json_files[0];
                try {
                    const content = await fs.readFile(path.join(audit_dir, latest), 'utf8');
                    const parsed = JSON.parse(content);
                    const existing_hash = hash_content(parsed);
                    if (existing_hash === current_hash) skip = true;
                } catch (e) {
                    // Läser inte – skriv ny
                }
            }

            if (!skip) {
                const filename = generate_audit_filename(full_state, server_t_func, {});
                const target_path = path.join(audit_dir, filename);
                const tmp_path = target_path + '.tmp';

                await fs.writeFile(tmp_path, JSON.stringify(full_state, null, 2), 'utf8');
                await fs.rename(tmp_path, target_path);
                new_files++;
            }
        } catch (err) {
            console.warn('[backup] Misslyckades för audit', audit_row?.id, ':', err.message);
        }
    }

    const settings = await get_backup_settings();
    await cleanup_old_backups(backup_dir, settings.retention_days);

    const status = {
        last_run: start_time,
        audits_processed: result.rows.length,
        new_files,
        backup_dir
    };
    last_backup_status = status;
    return status;
}

async function cleanup_old_backups(backup_dir, retention_days = DEFAULT_RETENTION_DAYS) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retention_days);
    const cutoff_time = cutoff.getTime();

    let removed = 0;
    try {
        const audit_ids = await fs.readdir(backup_dir);
        for (const aid of audit_ids) {
            const audit_path = path.join(backup_dir, aid);
            const stat = await fs.stat(audit_path);
            if (!stat.isDirectory()) continue;

            const files = await fs.readdir(audit_path);
            for (const f of files) {
                if (!f.endsWith('.json')) continue;
                const fp = path.join(audit_path, f);
                const fstat = await fs.stat(fp);
                if (fstat.mtimeMs < cutoff_time) {
                    await fs.unlink(fp);
                    removed++;
                }
            }
        }
    } catch (err) {
        console.warn('[backup] Rensning misslyckades:', err.message);
    }
    return removed;
}

let last_backup_status = null;
let backup_cron_task = null;

export async function run_backup() {
    return run_scheduled_backup();
}

/**
 * Startar eller startar om den schemalagda backupen utifrån sparade inställningar.
 * Anropas vid serverstart och efter PUT /api/backup/settings.
 */
export async function start_backup_scheduler() {
    if (backup_cron_task) {
        backup_cron_task.stop();
        backup_cron_task = null;
    }
    const settings = await get_backup_settings();
    const cron_expr = build_cron_from_settings(settings);
    backup_cron_task = cron.schedule(cron_expr, () => {
        run_backup()
            .then((s) => {
                console.log('[Server] Backup kördes:', s?.audits_processed, 'granskningar,', s?.new_files, 'nya filer');
            })
            .catch((err) => {
                console.warn('[Server] Backup misslyckades:', err.message);
            });
    });
}

export function get_last_backup_status() {
    return last_backup_status;
}

/**
 * Härleder backup-status från filsystemet när last_backup_status inte är satt (t.ex. efter serverstart).
 * Returnerar { last_run, audits_processed, new_files } eller null om katalogen är tom eller saknas.
 */
export async function get_backup_status_from_fs() {
    const backup_dir = get_backup_dir();
    let dir_entries;
    try {
        dir_entries = await fs.readdir(backup_dir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
    }
    const audit_dirs = dir_entries.filter((d) => d.isDirectory()).map((d) => d.name);
    if (audit_dirs.length === 0) return null;

    let latest_mtime = null;
    for (const audit_id of audit_dirs) {
        const audit_path = path.join(backup_dir, audit_id);
        let files;
        try {
            files = await fs.readdir(audit_path);
        } catch {
            continue;
        }
        for (const f of files) {
            if (!f.endsWith('.json')) continue;
            const fp = path.join(audit_path, f);
            try {
                const stat = await fs.stat(fp);
                if (!latest_mtime || stat.mtimeMs > latest_mtime) {
                    latest_mtime = stat.mtimeMs;
                }
            } catch {
                // Ignorera
            }
        }
    }
    if (latest_mtime == null) return null;
    return {
        last_run: new Date(latest_mtime).toISOString(),
        audits_processed: audit_dirs.length,
        new_files: 0
    };
}

/**
 * Sparar en kopia av granskningens fulla state som fil på servern.
 * @param {object} full_state - Full state från build_full_state
 * @param {object} options - options.backup_suffix_key = i18n-nyckel för filnamnssuffix (t.ex. 'filename_archive_suffix', 'filename_locked_suffix', 'filename_manual_save_suffix')
 */
export async function save_backup_for_audit(full_state, options = {}) {
    const backup_dir = get_backup_dir();
    await ensure_dir(backup_dir);

    const audit_id = full_state?.auditId;
    if (!audit_id) return;

    const audit_dir = path.join(backup_dir, audit_id);
    await ensure_dir(audit_dir);

    const suffix_key = options.backup_suffix_key || 'filename_archive_suffix';
    const filename = generate_audit_filename(full_state, server_t_func, {
        backup_suffix_key: suffix_key
    });
    const target_path = path.join(audit_dir, filename);
    const tmp_path = target_path + '.tmp';

    await fs.writeFile(tmp_path, JSON.stringify(full_state, null, 2), 'utf8');
    await fs.rename(tmp_path, target_path);
}

export async function save_archive_for_audit(full_state) {
    return save_backup_for_audit(full_state, { backup_suffix_key: 'filename_archive_suffix' });
}
