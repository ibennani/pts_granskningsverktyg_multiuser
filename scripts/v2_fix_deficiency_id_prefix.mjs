#!/usr/bin/env node
/**
 * Rättar legacy-brist-id (**deficiency_prefix**NN → BNN) i samples på v2-prod.
 *
 * Kör: node scripts/v2_fix_deficiency_id_prefix.mjs --dry-run
 *      node scripts/v2_fix_deficiency_id_prefix.mjs
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exec, exec_capture, disconnect, putFile } from './deploy-utils.js';
import { parse_db_json } from './lib/v2_release_sync_common.mjs';
import {
    CORRUPT_DEFICIENCY_ID_PREFIX,
    normalize_deficiency_id
} from '../js/logic/deficiency_id_format.ts';

const DRY_RUN = process.argv.includes('--dry-run');
const DB_NAME = 'granskningsverktyget';
const DB_CONTAINER = 'granskningsverktyget-db';
const DB_USER = 'granskning';
const MIGRATION_ACTOR = 'migration:deficiency_id_prefix_fix';

function dollar_quote(text, base = 'gv') {
    let tag = base;
    while (text.includes(`$${tag}$`)) tag = `${base}_${Math.random().toString(36).slice(2, 8)}`;
    return `$${tag}$${text}$${tag}$`;
}

function fix_samples_deficiency_ids(samples) {
    let fixed_count = 0;
    const next_samples = JSON.parse(JSON.stringify(samples ?? []));
    for (const sample of next_samples) {
        const req_results = sample?.requirementResults ?? {};
        for (const req_result of Object.values(req_results)) {
            const check_results = req_result?.checkResults ?? {};
            for (const check_result of Object.values(check_results)) {
                const pass_criteria = check_result?.passCriteria ?? {};
                for (const pc_result of Object.values(pass_criteria)) {
                    const current_id = pc_result?.deficiencyId;
                    if (
                        typeof current_id !== 'string'
                        || !current_id.includes(CORRUPT_DEFICIENCY_ID_PREFIX)
                    ) {
                        continue;
                    }
                    pc_result.deficiencyId = normalize_deficiency_id(current_id);
                    fixed_count += 1;
                }
            }
        }
    }
    return { samples: next_samples, fixed_count };
}

async function fetch_audits_with_samples() {
    const sql = `SELECT json_build_object('id', id::text, 'status', status, 'version', version, 'metadata', metadata, 'samples', samples)::text FROM audits ORDER BY metadata->>'actorName', metadata->>'caseNumber'`;
    const out = await exec_capture(
        `docker exec -e PGCLIENTENCODING=UTF8 ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -t -A -c ${JSON.stringify(sql)}`,
        { cwd: false }
    );
    return out.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function update_audit_samples(audit_id, samples, version) {
    const samples_json = JSON.stringify(samples);
    const sql = `UPDATE audits SET samples=${dollar_quote(samples_json, 's')}::jsonb, version=version+1, last_updated_by='${MIGRATION_ACTOR}', updated_at=NOW() WHERE id='${audit_id}'::uuid AND version=${version};\n`;
    const local_sql = join(tmpdir(), `gv_def_id_fix_${audit_id}.sql`);
    const remote_sql = `/tmp/gv_def_id_fix_${audit_id}.sql`;
    const container_sql = `/tmp/gv_def_id_fix_${audit_id}.sql`;
    writeFileSync(local_sql, sql, 'utf8');
    await putFile(local_sql, remote_sql);
    await exec(`docker cp ${remote_sql} ${DB_CONTAINER}:${container_sql}`, { cwd: false });
    await exec(`docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -f ${container_sql}`, { cwd: false });
    await exec(`rm -f ${remote_sql}`, { cwd: false });
    await exec(`docker exec ${DB_CONTAINER} rm -f ${container_sql}`, { cwd: false });
    unlinkSync(local_sql);
}

async function main() {
    const audits = await fetch_audits_with_samples();
    const report = {
        dry_run: DRY_RUN,
        updated: [],
        skipped: [],
        errors: [],
        total_ids_fixed: 0,
    };

    console.log(`Rättar brist-id-prefix i ${audits.length} granskningar${DRY_RUN ? ' (torrkörning)' : ''}.`);

    for (const row of audits) {
        try {
            const metadata = parse_db_json(row.metadata) || {};
            const samples = parse_db_json(row.samples) || [];
            const actor = metadata.actorName || '';
            const case_number = metadata.caseNumber || '';
            const { samples: fixed_samples, fixed_count } = fix_samples_deficiency_ids(samples);

            if (fixed_count === 0) {
                report.skipped.push({ id: row.id, actor, case_number, reason: 'inga korrupta brist-id' });
                continue;
            }

            report.total_ids_fixed += fixed_count;
            const entry = { id: row.id, actor, case_number, status: row.status, fixed_count };
            report.updated.push(entry);

            if (!DRY_RUN) {
                await update_audit_samples(row.id, fixed_samples, row.version);
            }

            console.log(`[${DRY_RUN ? 'dry' : 'set'}] ${actor} (${case_number}): ${fixed_count} brist-id`);
        } catch (error) {
            report.errors.push({
                id: row.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    const report_path = join(process.cwd(), '.cursor', 'v2_fix_deficiency_id_prefix_report.json');
    writeFileSync(report_path, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nUppdaterade: ${report.updated.length}, hoppade: ${report.skipped.length}, fel: ${report.errors.length}`);
    console.log(`Totalt rättade brist-id: ${report.total_ids_fixed}`);
    console.log(`Rapport: ${report_path}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => disconnect());
