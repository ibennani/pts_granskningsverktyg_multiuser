/**
 * Sätter granskningstyp på alla lokala granskningar:
 * PDF → Marknadskontroll, Webb → Tillsyn (via id i kopplad regelfil).
 * Kör: node scripts/set_local_audit_types.mjs
 *      node scripts/set_local_audit_types.mjs --dry-run
 */
import pg from 'pg';
import { apply_audit_type_selection } from '../shared/audit/audit_type_metadata.js';
import { build_default_published_audit_types_content } from '../shared/audit/audit_type_rule_set_resolve.js';
import {
    apply_audit_type_overlay_to_rule_content,
    snapshot_lacks_audit_types,
} from '../shared/audit/audit_type_catalog.js';

const DRY_RUN = process.argv.includes('--dry-run');

const WEBB_TYPE_ID = 'tillsyn-lptt';
const PDF_TYPE_ID = 'marknadskontroll-lptt';

const pool = new pg.Pool({
    connectionString:
        process.env.DATABASE_URL ||
        'postgresql://granskning:granskning@localhost:5432/granskningsverktyget',
});

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

function normalize_media_kind(rule_content) {
    const m = rule_content?.metadata?.monitoringType;
    const text = typeof m?.text === 'string' ? m.text.trim() : '';
    const typ = typeof m?.type === 'string' ? m.type.trim() : '';
    const raw = (typ || text).toLowerCase();
    if (!raw) return null;
    if (raw.includes('pdf')) return 'pdf';
    if (raw === 'web' || raw.includes('webb') || raw.includes('web')) return 'webb';
    return raw;
}

function effective_rule_content(audit_row, rule_set_row) {
    let rule = parse_json(audit_row.rule_file_content) ?? parse_json(rule_set_row?.content);
    if (!rule) return null;
    const published = parse_json(rule_set_row?.published_content);
    rule = apply_audit_type_overlay_to_rule_content(rule, published);
    if (snapshot_lacks_audit_types(rule)) {
        rule = apply_audit_type_overlay_to_rule_content(
            rule,
            build_default_published_audit_types_content()
        );
    }
    return rule;
}

function target_type_id_for_media(media_kind) {
    if (media_kind === 'pdf') return PDF_TYPE_ID;
    if (media_kind === 'webb') return WEBB_TYPE_ID;
    return null;
}

async function run() {
    const result = await pool.query(
        `SELECT a.id, a.status, a.metadata, a.rule_file_content,
                r.content, r.published_content
         FROM audits a
         LEFT JOIN rule_sets r ON r.id = a.rule_set_id
         ORDER BY a.id`
    );

    console.log(`Hittade ${result.rows.length} granskningar${DRY_RUN ? ' (torrkörning)' : ''}.`);

    let updated = 0;
    let skipped = 0;

    for (const row of result.rows) {
        const metadata = parse_json(row.metadata) ?? {};
        const rule = effective_rule_content(row, row);
        const media = normalize_media_kind(rule);
        const target_id = target_type_id_for_media(media);

        if (!target_id) {
            console.log(`  SKIP ${row.id}: okänd media (${media ?? 'saknas'})`);
            skipped += 1;
            continue;
        }

        const draft = { ...metadata };
        const ok = apply_audit_type_selection(draft, rule, target_id);
        if (!ok) {
            console.log(`  SKIP ${row.id}: kunde inte sätta ${target_id} i regelfil`);
            skipped += 1;
            continue;
        }

        const prev_id = String(metadata.auditTypeId ?? '').trim();
        const prev_label = String(metadata.auditTypeLabel ?? '').trim();
        if (prev_id === draft.auditTypeId && prev_label === draft.auditTypeLabel) {
            console.log(`  OK   ${row.id}: redan ${draft.auditTypeLabel} (${media})`);
            continue;
        }

        console.log(
            `  SET  ${row.id} [${media}]: ${prev_label || '(tom)'} → ${draft.auditTypeLabel}`
        );

        if (!DRY_RUN) {
            await pool.query('UPDATE audits SET metadata = $1::jsonb WHERE id = $2', [
                JSON.stringify(draft),
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
