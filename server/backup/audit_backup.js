/**
 * Schemalagd backup av granskningar till JSON-filer.
 * Körs kl 12 och 18, sparar endast vid ändringar, rensar filer äldre än 30 dagar.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { build_full_state } from '../routes/audits.js';
import { generate_audit_filename } from '../../js/utils/filename_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RETENTION_DAYS = 30;

const SERVER_T_KEYS = {
    filename_audit_prefix: 'tillganglighetsgranskning',
    filename_fallback_actor: 'granskning',
    filename_archive_suffix: 'arkiv'
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

    await cleanup_old_backups(backup_dir);

    const status = {
        last_run: start_time,
        audits_processed: result.rows.length,
        new_files,
        backup_dir
    };
    last_backup_status = status;
    return status;
}

async function cleanup_old_backups(backup_dir) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
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

export async function run_backup() {
    return run_scheduled_backup();
}

export function get_last_backup_status() {
    return last_backup_status;
}

export async function save_archive_for_audit(full_state) {
    const backup_dir = get_backup_dir();
    await ensure_dir(backup_dir);

    const audit_id = full_state?.auditId;
    if (!audit_id) return;

    const audit_dir = path.join(backup_dir, audit_id);
    await ensure_dir(audit_dir);

    const filename = generate_audit_filename(full_state, server_t_func, {
        backup_suffix_key: 'filename_archive_suffix'
    });
    const target_path = path.join(audit_dir, filename);
    const tmp_path = target_path + '.tmp';

    await fs.writeFile(tmp_path, JSON.stringify(full_state, null, 2), 'utf8');
    await fs.rename(tmp_path, target_path);
}
