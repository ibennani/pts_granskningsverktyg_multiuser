/**
 * Förhindrar att tunna fasader växer till monoliter igen (prio 1-regression).
 * Justeras vid medvetet beslut om gränserna ska höjas.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const MAX_EXPORT_LOGIC_LINES = 40;
const MAX_AUDIT_LOGIC_LINES = 95;

function line_count(file_path) {
    const raw = fs.readFileSync(file_path, 'utf8');
    return raw.split(/\r?\n/).length;
}

const export_logic_path = path.join(root, 'js', 'export_logic.ts');
const audit_logic_path = path.join(root, 'js', 'audit_logic.ts');

const export_lines = line_count(export_logic_path);
const audit_lines = line_count(audit_logic_path);

let failed = false;
if (export_lines > MAX_EXPORT_LOGIC_LINES) {
    console.error(
        `[check-export-facades] js/export_logic.ts: ${export_lines} rader (max ${MAX_EXPORT_LOGIC_LINES}). Lägg exportlogik under js/export/.`
    );
    failed = true;
}
if (audit_lines > MAX_AUDIT_LOGIC_LINES) {
    console.error(
        `[check-export-facades] js/audit_logic.ts: ${audit_lines} rader (max ${MAX_AUDIT_LOGIC_LINES}). Lägg logik under js/logic/audit_logic_*.ts.`
    );
    failed = true;
}

if (failed) {
    process.exit(1);
}

console.log(`[check-export-facades] OK (export_logic ${export_lines} rader, audit_logic ${audit_lines} rader).`);
