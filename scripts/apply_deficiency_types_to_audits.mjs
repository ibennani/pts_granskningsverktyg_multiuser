/**
 * Sprider DeficiencyType till inbäddad regelfil (rule_file_content) i alla granskningar.
 *
 * Kör: npx tsx scripts/apply_deficiency_types_to_audits.mjs
 *      npx tsx scripts/apply_deficiency_types_to_audits.mjs --dry-run
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
    apply_deficiency_types_to_content,
    build_deficiency_type_lookup,
    read_deficiency_types_tsv,
} from '../js/logic/deficiency_types_import_match.ts';
import { normalize_media_kind } from './lib/audit_media_kind.mjs';
import { DEFAULT_LOCAL_DATABASE_URL } from './lib/rulefile_sync_targets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TSV = path.join(__dirname, 'data', 'deficiency_types_master.tsv');
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

function deficiency_options_for_rule(rule_content) {
    const media = normalize_media_kind(rule_content);
    return {
        use_pdf_aliases: media === 'pdf',
        require_all_matches: false,
    };
}

async function run() {
    const tsv_path = process.argv.find((arg) => !arg.startsWith('-') && arg.endsWith('.tsv'))
        || DEFAULT_TSV;
    const entries = read_deficiency_types_tsv(tsv_path);
    const lookup = build_deficiency_type_lookup(entries);

    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL,
    });

    const result = await pool.query(
        'SELECT id, rule_file_content FROM audits ORDER BY id'
    );

    console.log(
        `Uppdaterar bristtyper i ${result.rows.length} granskningar${DRY_RUN ? ' (torrkörning)' : ''}.`
    );

    let updated = 0;
    let skipped = 0;

    for (const row of result.rows) {
        const content = parse_json(row.rule_file_content);
        if (!content || typeof content !== 'object') {
            console.log(`  SKIP ${row.id}: saknar rule_file_content`);
            skipped += 1;
            continue;
        }

        const cloned = structuredClone(content);
        const stats = apply_deficiency_types_to_content(cloned, lookup, deficiency_options_for_rule(cloned));

        if (stats.updated_count === 0) {
            skipped += 1;
            continue;
        }

        console.log(`  SET  ${row.id}: ${stats.updated_count} krav`);
        if (!DRY_RUN) {
            await pool.query('UPDATE audits SET rule_file_content = $1::jsonb WHERE id = $2', [
                JSON.stringify(cloned),
                row.id,
            ]);
        }
        updated += 1;
    }

    console.log(`Klart. Uppdaterade: ${updated}, hoppade över: ${skipped}.`);
    await pool.end();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
