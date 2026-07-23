/**
 * Sätter granskningstyp per ärendenummer:
 * minst en PDF-granskning i ärendet → alla Marknadskontroll, annars Tillsyn.
 *
 * Kör: node scripts/set_audit_types_by_case.mjs
 *      node scripts/set_audit_types_by_case.mjs --dry-run
 */
import pg from 'pg';
import { apply_audit_type_selection } from '../shared/audit/audit_type_metadata.js';
import { build_default_published_audit_types_content } from '../shared/audit/audit_type_rule_set_resolve.js';
import {
    apply_audit_type_overlay_to_rule_content,
    snapshot_lacks_audit_types,
} from '../shared/audit/audit_type_catalog.js';
import { build_case_type_plan } from './lib/audit_types_by_case.mjs';
import { DEFAULT_LOCAL_DATABASE_URL } from './lib/rulefile_sync_targets.mjs';

const DRY_RUN = process.argv.includes('--dry-run');

function parse_json(value) {
    if (value === null || value === undefined) return null;
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

function effective_rule_content(audit_row) {
    let rule = parse_json(audit_row.rule_file_content);
    if (!rule) return null;
    if (snapshot_lacks_audit_types(rule)) {
        rule = apply_audit_type_overlay_to_rule_content(
            rule,
            build_default_published_audit_types_content()
        );
    }
    return rule;
}

function create_pool() {
    return new pg.Pool({
        connectionString: process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL,
    });
}

async function fetch_audits(pool) {
    const result = await pool.query(
        `SELECT id, metadata, rule_file_content
         FROM audits
         ORDER BY id`
    );
    return result.rows.map((row) => ({
        id: row.id,
        metadata: parse_json(row.metadata) ?? {},
        rule_file_content: parse_json(row.rule_file_content),
    }));
}

async function apply_plan(pool, audits, plan) {
    const audit_by_id = new Map(audits.map((row) => [row.id, row]));
    let updated = 0;
    let skipped = 0;

    for (const [case_number, entry] of plan.entries()) {
        for (const audit_id of entry.audit_ids) {
            const audit = audit_by_id.get(audit_id);
            if (!audit) continue;

            const rule = effective_rule_content(audit);
            if (!rule) {
                console.log(`  SKIP ${audit_id} (${case_number}): saknar regelfil`);
                skipped += 1;
                continue;
            }

            const draft = { ...audit.metadata };
            const ok = apply_audit_type_selection(draft, rule, entry.target_type_id);
            if (!ok) {
                console.log(`  SKIP ${audit_id} (${case_number}): kunde inte sätta ${entry.target_type_id}`);
                skipped += 1;
                continue;
            }

            const prev_label = String(audit.metadata.auditTypeLabel ?? '').trim();
            if (
                String(audit.metadata.auditTypeId ?? '').trim() === draft.auditTypeId
                && prev_label === draft.auditTypeLabel
            ) {
                continue;
            }

            console.log(
                `  SET  ${audit_id} [${case_number}]: ${prev_label || '(tom)'} → ${draft.auditTypeLabel}`
            );

            if (!DRY_RUN) {
                await pool.query('UPDATE audits SET metadata = $1::jsonb WHERE id = $2', [
                    JSON.stringify(draft),
                    audit_id,
                ]);
            }
            updated += 1;
        }
    }

    return { updated, skipped };
}

async function run() {
    const pool = create_pool();
    const audits = await fetch_audits(pool);
    const plan = build_case_type_plan(audits);

    console.log(
        `Hittade ${audits.length} granskningar, ${plan.size} ärenden${DRY_RUN ? ' (torrkörning)' : ''}.`
    );

    const { updated, skipped } = await apply_plan(pool, audits, plan);
    console.log(`Klart. Uppdaterade: ${updated}, hoppade över: ${skipped}.`);
    await pool.end();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
