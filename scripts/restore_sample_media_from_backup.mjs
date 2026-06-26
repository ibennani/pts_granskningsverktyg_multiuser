#!/usr/bin/env node
/**
 * Återställer attachedMediaFilenames (och urlAutoScreenshotFilename) på granskningsdelar
 * från en JSON-säkerhetskopia utan att skriva över övrig granskningsdata.
 *
 * Lokal körning (mot DATABASE_URL):
 *   node scripts/restore_sample_media_from_backup.mjs <audit-id> [backup-filnamn]
 *
 * Fjärr körning på v2-servern:
 *   node scripts/restore_sample_media_from_backup_remote.mjs <audit-id> [backup-filnamn]
 */
import 'dotenv/config';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const audit_id = process.argv[2];
const backup_filename_arg = process.argv[3] || null;

if (!audit_id) {
    console.error('Användning: node scripts/restore_sample_media_from_backup.mjs <audit-id> [backup-filnamn]');
    process.exit(1);
}

function backup_base_dir() {
    return process.env.GV_BACKUP_DIR || join(process.cwd(), 'backup');
}

function list_backup_files(audit_id_local) {
    const dir = join(backup_base_dir(), audit_id_local);
    return readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
            const fp = join(dir, name);
            const stat = statSync(fp);
            return { name, fp, mtime_ms: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime_ms - a.mtime_ms);
}

function normalize_filenames(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((f) => String(f).trim()).filter(Boolean);
}

function count_samples_with_media(samples) {
    if (!Array.isArray(samples)) return 0;
    return samples.filter((s) => normalize_filenames(s?.attachedMediaFilenames).length > 0).length;
}

function pick_backup_file(audit_id_local, explicit_name) {
    const files = list_backup_files(audit_id_local);
    if (files.length === 0) {
        throw new Error(`Inga backup-filer hittades i ${join(backup_base_dir(), audit_id_local)}`);
    }
    if (explicit_name) {
        const match = files.find((f) => f.name === explicit_name);
        if (!match) {
            throw new Error(`Backup-filen "${explicit_name}" hittades inte`);
        }
        return match;
    }

    let best = null;
    for (const file of files) {
        const data = JSON.parse(readFileSync(file.fp, 'utf8'));
        const media_count = count_samples_with_media(data.samples);
        if (media_count === 0) continue;
        if (!best || file.mtime_ms > best.file.mtime_ms) {
            best = { file, media_count, audit_status: data.auditStatus || null };
        }
    }
    if (!best) {
        throw new Error('Ingen backup med bifogad media på granskningsdel hittades');
    }
    return best.file;
}

function merge_sample_media_from_backup(current_samples, backup_samples) {
    if (!Array.isArray(current_samples)) {
        throw new Error('Aktuella granskningsdel saknas eller är ogiltiga');
    }
    if (!Array.isArray(backup_samples)) {
        throw new Error('Backup saknar granskningsdel');
    }

    const backup_by_id = new Map();
    for (const sample of backup_samples) {
        if (sample?.id != null && String(sample.id) !== '') {
            backup_by_id.set(String(sample.id), sample);
        }
    }

    let restored_samples = 0;
    let restored_filenames = 0;
    const merged = current_samples.map((sample) => {
        const sample_id = sample?.id != null ? String(sample.id) : '';
        const backup_sample = sample_id ? backup_by_id.get(sample_id) : null;
        if (!backup_sample) return sample;

        const backup_filenames = normalize_filenames(backup_sample.attachedMediaFilenames);
        const current_filenames = normalize_filenames(sample.attachedMediaFilenames);
        const backup_auto = typeof backup_sample.urlAutoScreenshotFilename === 'string'
            ? backup_sample.urlAutoScreenshotFilename.trim()
            : '';
        const current_auto = typeof sample.urlAutoScreenshotFilename === 'string'
            ? sample.urlAutoScreenshotFilename.trim()
            : '';

        const next = { ...sample };
        let changed = false;

        if (backup_filenames.length > 0 && backup_filenames.join('\u0001') !== current_filenames.join('\u0001')) {
            next.attachedMediaFilenames = backup_filenames;
            restored_filenames += backup_filenames.length;
            changed = true;
        }
        if (backup_auto && backup_auto !== current_auto) {
            next.urlAutoScreenshotFilename = backup_auto;
            changed = true;
        }
        if (changed) restored_samples += 1;
        return next;
    });

    return { merged, restored_samples, restored_filenames, backup_sample_count: backup_by_id.size };
}

async function main() {
    const backup_file = pick_backup_file(audit_id, backup_filename_arg);
    const backup_data = JSON.parse(readFileSync(backup_file.fp, 'utf8'));

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const before = await pool.query(
            'SELECT version, status, samples FROM audits WHERE id = $1',
            [audit_id]
        );
        if (before.rows.length === 0) {
            throw new Error(`Granskning saknas: ${audit_id}`);
        }

        const row = before.rows[0];
        const current_samples = row.samples;
        const { merged, restored_samples, restored_filenames, backup_sample_count } = merge_sample_media_from_backup(
            current_samples,
            backup_data.samples
        );

        if (restored_samples === 0) {
            console.info('[media-restore] Inget att återställa — aktuella granskningsdel har redan samma media som backup.');
            return;
        }

        console.info('[media-restore] Backup:', backup_file.name);
        console.info('[media-restore] Granskningsdel i backup:', backup_sample_count);
        console.info('[media-restore] Granskningsdel som uppdateras:', restored_samples);
        console.info('[media-restore] Filnamn totalt:', restored_filenames);
        console.info('[media-restore] Före — version:', row.version, 'status:', row.status);

        const updated = await pool.query(
            `UPDATE audits SET
                samples = $1::jsonb,
                version = version + 1,
                last_updated_by = $2,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING version, status, updated_at::text AS updated_at`,
            [JSON.stringify(merged), 'Återställning av granskningsdelsbilder från säkerhetskopia', audit_id]
        );

        const after = updated.rows[0];
        console.info('[media-restore] Efter — version:', after.version, 'status:', after.status, 'updated_at:', after.updated_at);
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('[media-restore] Fel:', err.message);
    process.exit(1);
});
