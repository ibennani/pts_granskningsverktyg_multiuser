#!/usr/bin/env node
/**
 * Fyller bedömningsluckor i låsta/arkiverade granskningar (kontrollpunkt → inte aktuellt, kriterium → ingen anmärkning).
 * Kör backup först: node scripts/db-backup-remote.js
 *
 * Användning:
 *   npx tsx server/scripts/migrate_closed_audit_assessment_gaps.js --dry-run
 *   npx tsx server/scripts/migrate_closed_audit_assessment_gaps.js --apply
 */
import 'dotenv/config';
import { query } from '../db.js';
import { build_full_state } from '../routes/audit_build_state.js';
import {
    apply_closed_audit_assessment_gap_fill,
    audit_has_fully_assessed_relevant_requirements,
    count_incomplete_assessments_in_audit
} from '../../js/logic/closed_audit_assessment_gap_fill.js';
import { compute_audit_progress_percent } from '../../js/logic/audit_list_progress.js';

const MIGRATION_ACTOR = 'migration:closed_audit_gap_fill';

function parse_args(argv) {
    const apply = argv.includes('--apply');
    const dry_run = argv.includes('--dry-run') || !apply;
    return { dry_run, apply };
}

async function fetch_closed_audits() {
    return query(
        `SELECT a.*, r.published_content, r.content
         FROM audits a
         LEFT JOIN rule_sets r ON a.rule_set_id = r.id
         WHERE a.status IN ('locked', 'archived')
         ORDER BY a.updated_at DESC`
    );
}

function build_state_from_row(row) {
    const rule_set_row = row.published_content || row.content
        ? { published_content: row.published_content, content: row.content }
        : null;
    return build_full_state(row, rule_set_row);
}

async function update_audit_samples(audit_id, samples, previous_version) {
    const result = await query(
        `UPDATE audits
         SET samples = $1::jsonb,
             version = version + 1,
             last_updated_by = $2,
             updated_at = NOW()
         WHERE id = $3 AND version = $4
         RETURNING id, version`,
        [JSON.stringify(samples), MIGRATION_ACTOR, audit_id, previous_version]
    );
    return result.rows[0] ?? null;
}

async function run_migration({ dry_run }) {
    const result = await fetch_closed_audits();
    let changed_count = 0;
    let already_complete = 0;
    let verification_failures = 0;

    for (const row of result.rows) {
        const state = build_state_from_row(row);
        const progress_before = compute_audit_progress_percent(state);
        const incomplete_before = count_incomplete_assessments_in_audit(state);
        const { state: next_state, changed, stats } = apply_closed_audit_assessment_gap_fill(state, {
            updated_by: MIGRATION_ACTOR
        });
        const progress_after = compute_audit_progress_percent(next_state);
        const incomplete_after = count_incomplete_assessments_in_audit(next_state);
        const fully_assessed = audit_has_fully_assessed_relevant_requirements(next_state);

        if (!changed && progress_before === 100 && fully_assessed) {
            already_complete += 1;
            continue;
        }

        if (!fully_assessed) {
            verification_failures += 1;
            console.warn(
                `[gap-fill] VERIFIERING MISSLYCKAD ${row.id} (${row.status})`,
                { progress_after, incomplete_after, stats }
            );
            if (!dry_run) {
                throw new Error(`Migrering avbruten: granskning ${row.id} har kvar ofullständiga bedömningar`);
            }
            continue;
        }

        if (!changed) {
            continue;
        }

        changed_count += 1;
        console.info(
            `[gap-fill] ${row.id} (${row.status}) progress ${progress_before}% → ${progress_after}%`,
            { incomplete_before, incomplete_after, stats }
        );

        if (dry_run) {
            continue;
        }

        const updated = await update_audit_samples(row.id, next_state.samples, row.version);
        if (!updated) {
            throw new Error(`Versionskonflikt vid uppdatering av granskning ${row.id}`);
        }
    }

    console.info(
        `[gap-fill] ${dry_run ? 'Torrkörning' : 'Migrering'} klar:`,
        changed_count,
        'ändrade,',
        already_complete,
        'redan 100%,',
        verification_failures,
        'verifieringsfel,',
        result.rows.length,
        'totalt låsta/arkiverade'
    );

    if (verification_failures > 0) {
        process.exitCode = 1;
    }
}

const { dry_run, apply } = parse_args(process.argv.slice(2));
if (!dry_run && !apply) {
    console.error('Ange --dry-run eller --apply');
    process.exit(1);
}

run_migration({ dry_run }).catch((err) => {
    console.error('[gap-fill] Fel:', err.message);
    process.exit(1);
});
