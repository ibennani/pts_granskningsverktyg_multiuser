/**
 * @fileoverview Stoppar TS-klassfält med `!` på metodsignaturer — skuggar prototyp-delegater i runtime.
 *
 * Med target ES2022 + Vite/SWC blir `method!: () => void` egna instansfält (undefined) som döljer
 * metoder satta via `attach_*_delegates(Class.prototype)`.
 *
 * Använd `declare method: () => void` för metoder som sätts utanför klasskroppen.
 * Kör via `npm run check:ts-prototype-fields` (ingår i `npm run check`).
 */
import fs from 'fs';
import path from 'path';

const METHOD_DEFINITE_ASSIGNMENT_RE = /^\s+(?!declare\s)(\w+)!:\s*(\(\)|\([^)]*\)\s*=>|\()/;

function walk_ts_files(dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        if (e.isDirectory()) walk_ts_files(p, acc);
        else if (e.name.endsWith('.ts')) acc.push(p);
    }
    return acc;
}

function strip_line_comments(line) {
    return line.replace(/\/\/.*$/, '');
}

function find_method_definite_assignment_issues(filePath, cwd) {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split('\n');
    const issues = [];

    for (let i = 0; i < lines.length; i++) {
        const line = strip_line_comments(lines[i]);
        if (METHOD_DEFINITE_ASSIGNMENT_RE.test(line)) {
            issues.push(`${path.relative(cwd, filePath)}:${i + 1}: ${lines[i].trim()}`);
            continue;
        }
        const open_paren_only = /^\s+(?!declare\s)(\w+)!:\s*\(\s*$/.exec(line);
        if (open_paren_only) {
            const tail = lines.slice(i, i + 8).join('\n');
            if (/=>/.test(tail)) {
                issues.push(`${path.relative(cwd, filePath)}:${i + 1}: ${lines[i].trim()} (metod med ! skuggar prototyp)`);
            }
        }
    }

    return issues;
}

const cwd = process.cwd();
const js_root = path.join(cwd, 'js');
const files = walk_ts_files(js_root);
const all_issues = files.flatMap((f) => find_method_definite_assignment_issues(f, cwd));

if (all_issues.length) {
    console.error(
        'verify_ts_prototype_delegate_fields: använd declare (inte !) för metoder som sätts på prototyp:\n' +
            all_issues.join('\n')
    );
    process.exit(1);
}

console.log('OK: inga TS-klassfält med ! på metodsignaturer under js/.');
