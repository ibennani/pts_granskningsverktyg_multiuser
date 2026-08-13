/**
 * @fileoverview Hämtar regelfil från granskning för snapshot-analys-sammanfattning.
 */
import { query } from '../db.js';

function parse_rule_file_content(raw: unknown): Record<string, unknown> | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
    }
    return null;
}

export async function load_audit_rule_file_content(audit_id: string): Promise<unknown | null> {
    const result = await query('SELECT rule_file_content FROM audits WHERE id = $1', [audit_id]);
    if (result.rows.length === 0) {
        return null;
    }
    return parse_rule_file_content(result.rows[0].rule_file_content);
}
