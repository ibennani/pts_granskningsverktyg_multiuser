/**
 * @file Gemensam cache för om rule_sets har kolumnen published_content (schema-variationer).
 */

import { query } from '../db.js';

let has_published_content_column_cache = null;

/**
 * @returns {Promise<boolean>}
 */
export async function has_rule_sets_published_content_column() {
    if (has_published_content_column_cache !== null) {
        return has_published_content_column_cache;
    }
    try {
        const result = await query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_name = 'rule_sets' AND column_name = 'published_content'
             LIMIT 1`
        );
        has_published_content_column_cache = result.rows.length > 0;
    } catch (err) {
        console.warn('[rule_sets_column] Kunde inte kontrollera published_content-kolumn:', err.message);
        has_published_content_column_cache = false;
    }
    return has_published_content_column_cache;
}
