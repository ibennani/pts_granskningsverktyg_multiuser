/**
 * @fileoverview Regressionsskydd: granskningslogikens fasad och delmoduler får inte återfå @ts-nocheck.
 * Kör via npm run check:audit-logic-strict (ingår i npm run check).
 */
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const logic_dir = path.join(cwd, 'js', 'logic');

const targets = [path.join(cwd, 'js', 'audit_logic.ts')];
for (const name of fs.readdirSync(logic_dir)) {
    if (name.startsWith('audit_logic_') && name.endsWith('.ts')) {
        targets.push(path.join(logic_dir, name));
    }
}

const issues = [];
for (const abs of targets) {
    const text = fs.readFileSync(abs, 'utf8');
    if (/(?:^|\n)\s*\/\/\s*@ts-nocheck\b/.test(text)) {
        issues.push(path.relative(cwd, abs));
    }
}

if (issues.length) {
    console.error(
        'verify_audit_logic_no_ts_nocheck: @ts-nocheck hittades i granskningslogik (ta bort eller flytta kod):\n' +
            issues.join('\n')
    );
    process.exit(1);
}

console.info('OK: audit_logic-fasad och audit_logic_*-moduler utan @ts-nocheck.');
