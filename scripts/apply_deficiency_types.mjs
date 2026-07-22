/**
 * @fileoverview Populerar DeficiencyType (PrimaryText/SecondaryText) i regelfiler från master-TSV.
 * Kör: npx tsx scripts/apply_deficiency_types.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
    apply_deficiency_types_to_content,
    build_deficiency_type_lookup,
    read_deficiency_types_tsv,
} from '../js/logic/deficiency_types_import_match.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TSV = path.join(__dirname, 'data', 'deficiency_types_master.tsv');

const RULEFILE_TARGETS = [
    {
        id: 'f6aa1b17-8e9e-4610-8423-e5ab0ec016d3',
        label: 'Webb (publicerad bas)',
        use_pdf_aliases: false,
        require_all_matches: true,
        update_published: true,
    },
    {
        id: '5d7c1c26-c07b-4a0d-ba22-ccf025033135',
        label: 'Webb (arbetskopia)',
        use_pdf_aliases: false,
        require_all_matches: true,
        update_published: false,
    },
    {
        id: '7b7ec664-1acc-4835-b60c-789b6ebba894',
        label: 'PDF (publicerad bas)',
        use_pdf_aliases: true,
        require_all_matches: false,
        update_published: true,
    },
    {
        id: '55cfbabd-adb3-4c97-a7d9-929c6d2437c5',
        label: 'PDF (arbetskopia)',
        use_pdf_aliases: true,
        require_all_matches: false,
        update_published: false,
    },
];

function resolve_tsv_path() {
    const arg_path = process.argv[2];
    return arg_path ? path.resolve(arg_path) : DEFAULT_TSV;
}

async function main() {
    const tsv_path = resolve_tsv_path();
    const entries = read_deficiency_types_tsv(tsv_path);
    const lookup = build_deficiency_type_lookup(entries);

    const pool = new pg.Pool({
        connectionString:
            process.env.DATABASE_URL
            || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget',
    });

    console.log(`Läser ${entries.length} rader från ${tsv_path}`);

    for (const target of RULEFILE_TARGETS) {
        const result = await pool.query(
            'SELECT id, name, content, published_content FROM rule_sets WHERE id = $1',
            [target.id]
        );
        if (result.rows.length === 0) {
            console.error(`Regelfil saknas: ${target.id} (${target.label})`);
            continue;
        }

        const row = result.rows[0];
        const content = structuredClone(row.content);
        const stats = apply_deficiency_types_to_content(content, lookup, {
            use_pdf_aliases: target.use_pdf_aliases,
            require_all_matches: target.require_all_matches,
        });

        if (target.update_published) {
            await pool.query(
                `UPDATE rule_sets
                 SET content = $1::jsonb,
                     published_content = $1::jsonb,
                     content_updated_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP,
                     version = version + 1
                 WHERE id = $2`,
                [JSON.stringify(content), target.id]
            );
        } else {
            await pool.query(
                `UPDATE rule_sets
                 SET content = $1::jsonb,
                     content_updated_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP,
                     version = version + 1
                 WHERE id = $2`,
                [JSON.stringify(content), target.id]
            );
        }

        console.log(`\n${row.name} (${target.label})`);
        console.log(`  Uppdaterade krav: ${stats.updated_count}`);
        if (stats.unmatched.length > 0) {
            console.log(`  Ej matchade krav (${stats.unmatched.length}):`);
            for (const item of stats.unmatched) {
                console.log(`    - ${item.label}`);
            }
        }
    }

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
