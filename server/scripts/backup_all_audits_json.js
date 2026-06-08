#!/usr/bin/env node
/**
 * Säkerhetskopierar alla granskningar som JSON på servern före datamigrering.
 * Användning: npx tsx server/scripts/backup_all_audits_json.js
 */
import 'dotenv/config';
import { query } from '../db.js';
import { build_full_state } from '../routes/audit_build_state.js';
import { save_backup_for_audit } from '../backup/audit_backup.js';

async function backup_all_audits_json() {
    const result = await query(
        `SELECT a.*, r.published_content, r.content
         FROM audits a
         LEFT JOIN rule_sets r ON a.rule_set_id = r.id
         ORDER BY a.updated_at DESC`
    );
    let saved = 0;
    let skipped = 0;
    for (const row of result.rows) {
        const rule_set_row = row.published_content || row.content
            ? { published_content: row.published_content, content: row.content }
            : null;
        const full_state = build_full_state(row, rule_set_row);
        if (!full_state?.auditId) {
            skipped += 1;
            continue;
        }
        await save_backup_for_audit(full_state, { backup_suffix_key: 'filename_manual_save_suffix' });
        saved += 1;
        console.info('[backup-all-audits] Sparade', full_state.auditId, `(${row.status})`);
    }
    console.info('[backup-all-audits] Klart:', saved, 'sparade,', skipped, 'hoppade över');
}

backup_all_audits_json().catch((err) => {
    console.error('[backup-all-audits] Fel:', err.message);
    process.exit(1);
});
