#!/usr/bin/env node
/**
 * Backfill av metadata.lastInProgressActivityAt för låsta/arkiverade granskningar.
 * Beräknar från befintliga tidsstämplar i stickprov (senaste interaktion under pågående granskning).
 * Ändrar inte audits.updated_at.
 *
 * Användning:
 *   npx tsx server/scripts/migrate_last_in_progress_activity_at.js --dry-run
 *   npx tsx server/scripts/migrate_last_in_progress_activity_at.js --apply
 */
import 'dotenv/config';
import { query } from '../db.js';
import { broadcast_audits_changed } from '../routes/audit_route_support.js';
import {
    AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY,
    get_last_activity_from_samples
} from '../../js/logic/audit_list_last_updated.js';

const MIGRATION_ACTOR = 'migration:last_in_progress_activity_at';

function parse_args(argv) {
    const apply = argv.includes('--apply');
    const dry_run = argv.includes('--dry-run') || !apply;
    return { dry_run, apply };
}

function parse_metadata(raw) {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
        } catch {
            return {};
        }
    }
    return {};
}

async function fetch_closed_audits() {
    return query(
        `SELECT id, metadata, samples, status, version, updated_at::text AS updated_at
         FROM audits
         WHERE status IN ('locked', 'archived')
         ORDER BY updated_at DESC`
    );
}

async function update_metadata_only(audit_id, metadata, previous_version) {
    const result = await query(
        `UPDATE audits
         SET metadata = $1::jsonb,
             version = version + 1,
             last_updated_by = $2,
             updated_at = updated_at
         WHERE id = $3 AND version = $4
         RETURNING id, version`,
        [JSON.stringify(metadata), MIGRATION_ACTOR, audit_id, previous_version]
    );
    return result.rows[0] ?? null;
}

async function run_migration({ dry_run }) {
    const result = await fetch_closed_audits();
    let would_update = 0;
    let updated = 0;
    let skipped_no_samples = 0;
    let skipped_already_ok = 0;

    for (const row of result.rows) {
        const computed = get_last_activity_from_samples(row.samples);
        if (!computed) {
            skipped_no_samples += 1;
            continue;
        }
        const metadata = parse_metadata(row.metadata);
        const existing = metadata[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY];
        if (existing === computed) {
            skipped_already_ok += 1;
            continue;
        }
        would_update += 1;
        const next_metadata = {
            ...metadata,
            [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: computed
        };
        console.info(
            `[${dry_run ? 'dry-run' : 'apply'}] ${row.id} (${row.status}):`,
            existing ? `${existing} → ${computed}` : `saknas → ${computed}`
        );
        if (!dry_run) {
            const saved = await update_metadata_only(row.id, next_metadata, Number(row.version));
            if (saved) updated += 1;
        }
    }

    console.info('');
    console.info(`Totalt låsta/arkiverade: ${result.rows.length}`);
    console.info(`Redan korrekta: ${skipped_already_ok}`);
    console.info(`Utan stickprovstidsstämplar: ${skipped_no_samples}`);
    console.info(`${dry_run ? 'Skulle uppdatera' : 'Uppdaterade'}: ${dry_run ? would_update : updated}`);
    if (!dry_run && updated > 0) {
        broadcast_audits_changed(null, { changeKind: 'full' });
    }
}

const { dry_run } = parse_args(process.argv.slice(2));
run_migration({ dry_run })
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
