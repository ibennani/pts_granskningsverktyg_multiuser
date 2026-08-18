#!/usr/bin/env node
/**
 * Återställer bristbeskrivningar från backup när samma text felaktigt ligger i flera granskningsdelar.
 *
 *   node scripts/v2_restore_observations_from_backup.mjs --dry-run
 *   node scripts/v2_restore_observations_from_backup.mjs --apply
 *   node scripts/v2_restore_observations_from_backup.mjs --apply --full
 *   node scripts/v2_restore_observations_from_backup.mjs --apply --audit-id=<uuid>
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exec, exec_capture, disconnect, putFile } from './deploy-utils.js';
import { ensure_sync_dir } from './lib/v2_release_sync_common.mjs';
import {
    build_observation_restore_patches,
    build_full_observation_restore_patches,
    apply_observation_restore_patches,
    find_duplicate_observation_groups,
} from '../js/logic/observation_detail_restore.ts';

const DRY_RUN = !process.argv.includes('--apply');
const FULL_RESTORE = process.argv.includes('--full');
const BACKUP_FILE = process.env.GV_OBS_RESTORE_BACKUP
    || '/var/www/granskningsverktyget-v2/backups/db/gv_postgres_20260817T223742Z.dump';
const DB_CONTAINER = process.env.GV_DB_CONTAINER || 'granskningsverktyget-db';
const DB_USER = process.env.GV_DB_USER || 'granskning';
const PROD_DB = process.env.GV_DB_NAME || 'granskningsverktyget';
const TEMP_DB = 'gv_obs_restore_tmp';
const audit_id_arg = process.argv.find((arg) => arg.startsWith('--audit-id='));
const ONLY_AUDIT_ID = audit_id_arg ? audit_id_arg.split('=')[1] : null;

function dollar_quote(text, base = 'gv') {
    let tag = base;
    while (text.includes(`$${tag}$`)) {
        tag = `${base}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return `$${tag}$${text}$${tag}$`;
}

async function ensure_temp_db_with_backup() {
    const container_backup = '/tmp/gv_obs_restore_backup.dump';
    await exec(`docker cp ${BACKUP_FILE} ${DB_CONTAINER}:${container_backup}`, { cwd: false });
    await exec(
        `docker exec ${DB_CONTAINER} bash -lc ` +
        `"dropdb -U ${DB_USER} --if-exists ${TEMP_DB} && createdb -U ${DB_USER} ${TEMP_DB} && pg_restore -U ${DB_USER} -d ${TEMP_DB} ${container_backup} && rm -f ${container_backup}"`,
        { cwd: false }
    );
}

async function fetch_audit_rows(db_name, audit_id = null) {
    const where = audit_id ? `WHERE id='${audit_id}'::uuid` : '';
    const sql = `SELECT json_build_object('id', id::text, 'actor', metadata->>'actorName', 'status', status, 'samples', samples)::text FROM audits ${where} ORDER BY metadata->>'actorName'`;
    const out = await exec_capture(
        `docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${db_name} -t -A -c ${JSON.stringify(sql)}`,
        { cwd: false }
    );
    return out.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function update_audit_samples(audit_id, samples) {
    const samples_json = JSON.stringify(samples);
    const sql = `UPDATE audits SET samples=${dollar_quote(samples_json, 's')}::jsonb, updated_at=NOW() WHERE id='${audit_id}'::uuid;`;
    const local_sql = join(tmpdir(), `gv_obs_restore_${audit_id}.sql`);
    const remote_sql = `/tmp/gv_obs_restore_${audit_id}.sql`;
    const container_sql = `/tmp/gv_obs_restore_${audit_id}.sql`;
    writeFileSync(local_sql, sql, 'utf8');
    await putFile(local_sql, remote_sql);
    await exec(`docker cp ${remote_sql} ${DB_CONTAINER}:${container_sql}`, { cwd: false });
    await exec(`docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${PROD_DB} -f ${container_sql}`, { cwd: false });
    await exec(`rm -f ${remote_sql}`, { cwd: false });
    await exec(`docker exec ${DB_CONTAINER} rm -f ${container_sql}`, { cwd: false });
}

async function main() {
    console.log(`[obs-restore] Backup: ${BACKUP_FILE}`);
    console.log(`[obs-restore] Läge: ${DRY_RUN ? 'dry-run' : 'apply'} (${FULL_RESTORE ? 'fullständig' : 'selektiv'})`);
    await ensure_temp_db_with_backup();

    const [current_rows, backup_rows] = await Promise.all([
        fetch_audit_rows(PROD_DB, ONLY_AUDIT_ID),
        fetch_audit_rows(TEMP_DB, ONLY_AUDIT_ID),
    ]);
    const backup_by_id = new Map(backup_rows.map((row) => [row.id, row]));

    const report = {
        dry_run: DRY_RUN,
        backup_file: BACKUP_FILE,
        audits: [],
        total_patches: 0,
        total_applied: 0,
    };

    for (const current of current_rows) {
        const backup = backup_by_id.get(current.id);
        if (!backup) {
            report.audits.push({ id: current.id, actor: current.actor, status: current.status, skipped: 'saknas i backup' });
            continue;
        }
        const duplicate_groups_before = find_duplicate_observation_groups(current.samples);
        const build_patches = FULL_RESTORE
            ? build_full_observation_restore_patches
            : build_observation_restore_patches;
        const patches = build_patches(current.samples, backup.samples);
        const audit_entry = {
            id: current.id,
            actor: current.actor,
            status: current.status,
            duplicate_groups_before: duplicate_groups_before.length,
            patches,
        };
        report.total_patches += patches.length;

        if (!DRY_RUN && patches.length > 0) {
            const samples_copy = JSON.parse(JSON.stringify(current.samples));
            const applied = apply_observation_restore_patches(samples_copy, patches);
            await update_audit_samples(current.id, samples_copy);
            audit_entry.applied = applied;
            audit_entry.duplicate_groups_after = find_duplicate_observation_groups(samples_copy).length;
            report.total_applied += applied;
        }

        report.audits.push(audit_entry);
        const label = `${current.actor} (${current.status})`;
        if (patches.length === 0) {
            console.log(`[obs-restore] ${label}: inga återställningar behövs`);
        } else {
            console.log(`[obs-restore] ${label}: ${patches.length} fält att återställa`);
            for (const patch of patches.slice(0, 5)) {
                console.log(`  - ${patch.sample_label} | ${patch.req_key} :: ${patch.check_id} :: ${patch.pc_id}`);
            }
            if (patches.length > 5) console.log(`  ... +${patches.length - 5} till`);
        }
    }

    const out = join(ensure_sync_dir('obs-restore'), `obs_restore_report${DRY_RUN ? '_dry_run' : ''}.json`);
    writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[obs-restore] Rapport: ${out}`);
    await exec(`docker exec ${DB_CONTAINER} dropdb -U ${DB_USER} --if-exists ${TEMP_DB}`, { cwd: false });
}

main()
    .catch((err) => {
        console.error('[obs-restore] Fel:', err?.message || err);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
