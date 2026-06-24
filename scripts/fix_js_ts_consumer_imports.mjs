/**
 * @fileoverview Skapar saknade .js-bryggor och byter konsument-imports från .ts till .js.
 * Kör: node scripts/fix_js_ts_consumer_imports.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const js_root = path.join(cwd, 'js');
const dry_run = process.argv.includes('--dry-run');

const importReTs = /(?:from|import)\s+['"](\.\.?\/[^'"]+\.ts)['"]/g;
const importReSideEffect = /import\s+['"](\.\.?\/[^'"]+\.ts)['"]\s*;/g;
const exportFromTsRe = /export\s+(\*|\{[^}]+\})\s+from\s+['"]\.\/[^'"]+\.tsx?['"]\s*;?/;

function walk_source_files(dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        if (e.isDirectory()) walk_source_files(p, acc);
        else if (e.name.endsWith('.js')) acc.push(p);
    }
    return acc;
}

function collect_ts_specs(text) {
    const out = new Set();
    for (const re of [importReTs, importReSideEffect]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) out.add(m[1]);
    }
    return [...out];
}

function is_thin_bridge(body) {
    const stripped = body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .trim();
    if (!exportFromTsRe.test(stripped)) return false;
    const lines = stripped.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.every((l) => exportFromTsRe.test(l) || l.startsWith('export'));
}

function bridge_body_for(js_abs) {
    const base = path.basename(js_abs, '.js');
    return `/**
 * Brygga: behåller import med .js-suffix (Vite extensionAlias + verify_js_only_imports).
 * Källan: ${base}.ts
 */
export * from './${base}.ts';
`;
}

function rel_js_from_ts_spec(filePath, spec) {
    const resolved = path.normalize(path.join(path.dirname(filePath), spec));
    return resolved.slice(0, -3) + '.js';
}

const js_files = walk_source_files(js_root);
const bridges_written = [];
const bridges_replaced = [];
const imports_fixed = [];

for (const filePath of js_files) {
    const text = fs.readFileSync(filePath, 'utf8');
    if (is_thin_bridge(text)) continue;

    const specs = collect_ts_specs(text);
    if (!specs.length) continue;

    let new_text = text;
    for (const spec of specs) {
        const ts_abs = path.normalize(path.join(path.dirname(filePath), spec));
        const js_abs = ts_abs.slice(0, -3) + '.js';
        const js_rel = spec.slice(0, -3) + '.js';

        if (!fs.existsSync(ts_abs)) {
            console.warn(`Saknar .ts-mål: ${path.relative(cwd, filePath)} → ${spec}`);
            continue;
        }

        if (fs.existsSync(js_abs)) {
            const existing = fs.readFileSync(js_abs, 'utf8');
            if (!is_thin_bridge(existing)) {
                if (dry_run) {
                    console.log(`[ersätt legacy] ${path.relative(cwd, js_abs)} → brygga till ${path.basename(ts_abs)}`);
                } else {
                    fs.writeFileSync(js_abs, bridge_body_for(js_abs), 'utf8');
                    bridges_replaced.push(path.relative(cwd, js_abs));
                }
            }
        } else if (dry_run) {
            console.log(`[skapa brygga] ${path.relative(cwd, js_abs)}`);
        } else {
            fs.writeFileSync(js_abs, bridge_body_for(js_abs), 'utf8');
            bridges_written.push(path.relative(cwd, js_abs));
        }

        new_text = new_text.split(`'${spec}'`).join(`'${js_rel}'`);
        new_text = new_text.split(`"${spec}"`).join(`"${js_rel}"`);
    }

    if (new_text !== text) {
        if (dry_run) {
            console.log(`[fix imports] ${path.relative(cwd, filePath)}`);
        } else {
            fs.writeFileSync(filePath, new_text, 'utf8');
            imports_fixed.push(path.relative(cwd, filePath));
        }
    }
}

console.log(
    dry_run
        ? 'Dry-run klar (ingen fil skriven).'
        : `Klart: ${bridges_written.length} nya bryggor, ${bridges_replaced.length} legacy ersatta, ${imports_fixed.length} filer med uppdaterade imports.`
);
if (!dry_run && bridges_written.length) {
    console.log('Nya bryggor:\n' + bridges_written.join('\n'));
}
if (!dry_run && bridges_replaced.length) {
    console.log('Legacy → brygga:\n' + bridges_replaced.join('\n'));
}
