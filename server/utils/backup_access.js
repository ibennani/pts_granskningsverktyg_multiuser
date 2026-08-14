/**
 * Behörighet för serversäkerhetskopior per granskning.
 */
import fs from 'fs/promises';
import path from 'path';
import { query } from '../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {{ id?: string, is_admin?: boolean } | null | undefined} user
 * @returns {boolean}
 */
export function is_backup_admin(user) {
    return user?.is_admin === true;
}

/**
 * @param {string} audit_id
 * @returns {Promise<string | null>}
 */
export async function get_responsible_user_id_from_db(audit_id) {
    if (!audit_id || !UUID_REGEX.test(audit_id)) return null;
    const result = await query(
        'SELECT responsible_user_id FROM audits WHERE id = $1',
        [audit_id]
    );
    const raw = result.rows[0]?.responsible_user_id;
    return raw ? String(raw) : null;
}

/**
 * @param {string} auditor_name
 * @returns {Promise<string | null>}
 */
export async function resolve_user_id_from_auditor_name(auditor_name) {
    const trimmed = String(auditor_name ?? '').trim();
    if (!trimmed) return null;
    const result = await query(
        `SELECT id FROM users
         WHERE TRIM(LOWER(name)) = TRIM(LOWER($1))
         ORDER BY created_at ASC
         LIMIT 2`,
        [trimmed]
    );
    if (result.rows.length !== 1) return null;
    return String(result.rows[0].id);
}

/**
 * Läser ansvarig användare från senaste JSON-säkerhetskopian.
 * @param {string} backup_dir
 * @param {string} audit_id
 * @returns {Promise<string | null>}
 */
export async function get_responsible_user_id_from_backup_files(backup_dir, audit_id) {
    if (!audit_id || !UUID_REGEX.test(audit_id)) return null;
    const audit_path = path.join(backup_dir, audit_id);
    let files;
    try {
        files = await fs.readdir(audit_path);
    } catch {
        return null;
    }
    const json_files = files.filter((f) => f.endsWith('.json'));
    if (json_files.length === 0) return null;

    let latest_fp = null;
    let latest_mtime = 0;
    for (const fname of json_files) {
        const fp = path.join(audit_path, fname);
        try {
            const stat = await fs.stat(fp);
            if (stat.mtimeMs >= latest_mtime) {
                latest_mtime = stat.mtimeMs;
                latest_fp = fp;
            }
        } catch {
            // ignorera
        }
    }
    if (!latest_fp) return null;

    try {
        const raw = await fs.readFile(latest_fp, 'utf8');
        const data = JSON.parse(raw);
        const from_field = data?.responsibleUserId;
        if (from_field && UUID_REGEX.test(String(from_field))) {
            return String(from_field);
        }
        const auditor_name = data?.auditMetadata?.auditorName;
        return await resolve_user_id_from_auditor_name(auditor_name);
    } catch {
        return null;
    }
}

/**
 * @param {{ id?: string, is_admin?: boolean } | null | undefined} user
 * @param {string} audit_id
 * @param {string} backup_dir
 * @returns {Promise<boolean>}
 */
export async function user_may_access_audit_backup(user, audit_id, backup_dir) {
    if (!user?.id) return false;
    if (is_backup_admin(user)) return true;
    if (!audit_id || !UUID_REGEX.test(audit_id)) return false;

    const from_db = await get_responsible_user_id_from_db(audit_id);
    if (from_db && from_db === String(user.id)) return true;

    const from_backup = await get_responsible_user_id_from_backup_files(backup_dir, audit_id);
    return Boolean(from_backup && from_backup === String(user.id));
}
