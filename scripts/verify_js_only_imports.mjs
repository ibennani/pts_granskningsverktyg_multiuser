/**
 * @fileoverview CI-/lokal kontroll för importvägar med .js-suffix under js/.
 *
 * 1) .js-filer får inte importera X.js när bara X.ts finns (samma klass av fel som Vite 404 i blandad migrering).
 * 2) Obligatoriska tunna bryggfiler (.js som re-exporterar .ts) får inte tas bort — undviker t.ex. 404 på
 *    requirement_lookup.js när källan bara ligger som .ts.
 * 3) Alla källfiler (.js/.ts/.tsx/.mts): relativa importmål *.js måste matcha minst en av .js / .ts / .tsx på disk.
 *
 * Kör via `npm run check:js-ts-imports` (ingår i `npm run check`).
 * Återsätt saknade bryggor: `node scripts/verify_js_only_imports.mjs --fix` eller `npm run fix:js-ts-bridges`.
 */
import fs from 'fs';
import path from 'path';

/** Tunna bryggor som måste finnas kvar (bygg ut listan när nya tillkommer). */
const REQUIRED_JS_REEXPORT_BRIDGES = [
    'js/audit_logic.js',
    'js/logic/ScoreCalculator.js',
    'js/logic/sanitize_persisted_app_state.js',
    'js/logic/table_pagination_logic.js',
    'js/logic/requirement_lookup.js',
    'js/logic/rulefile_updater_logic.js',
    'js/components/SideMenuComponent.js',
    'js/utils/string_filter_normalize.js',
    'js/utils/requirement_search_utils.js',
    'js/utils/vite_dev_client_timestamp.js',
    'js/utils/vite_dev_client_timestamp_hmr.js'
];

const importReStatic = /(?:from|import)\s+['"](\.\.?\/[^'"]+\.js)['"]/g;
const importReDynamic = /import\s*\(\s*['"](\.\.?\/[^'"]+\.js)['"]\s*\)/g;

const SOURCE_EXTS = new Set(['.js', '.ts', '.tsx', '.mts']);

const exportFromTsRe = /export\s+\*\s+from\s+['"]\.\/[^'"]+\.tsx?['"]\s*;?/;

function walk_source_files (dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        if (e.isDirectory()) walk_source_files(p, acc);
        else if (SOURCE_EXTS.has(path.extname(e.name))) acc.push(p);
    }
    return acc;
}

function stem_targets_exist (resolved_js_path) {
    if (fs.existsSync(resolved_js_path)) return true;
    const without_js = resolved_js_path.slice(0, -3);
    return fs.existsSync(`${without_js}.ts`) || fs.existsSync(`${without_js}.tsx`);
}

function collect_specs (text) {
    const out = [];
    for (const re of [importReStatic, importReDynamic]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) out.push(m[1]);
    }
    return out;
}

function verify_js_importers_no_ts_only_targets (js_files, cwd) {
    const issues = [];
    for (const filePath of js_files) {
        const text = fs.readFileSync(filePath, 'utf8');
        for (const spec of collect_specs(text)) {
            const resolved = path.normalize(path.join(path.dirname(filePath), spec));
            const ts_path = resolved.slice(0, -3) + '.ts';
            if (!fs.existsSync(resolved) && fs.existsSync(ts_path)) {
                issues.push(`${path.relative(cwd, filePath)}: ${spec}`);
            }
        }
    }
    return issues;
}

function verify_resolvable_relative_js (all_files, cwd) {
    const issues = [];
    for (const filePath of all_files) {
        const text = fs.readFileSync(filePath, 'utf8');
        for (const spec of collect_specs(text)) {
            const resolved = path.normalize(path.join(path.dirname(filePath), spec));
            if (!stem_targets_exist(resolved)) {
                issues.push(`${path.relative(cwd, filePath)}: ${spec} (saknas som .js/.ts/.tsx)`);
            }
        }
    }
    return issues;
}

function verify_required_bridges (cwd) {
    const issues = [];
    for (const rel of REQUIRED_JS_REEXPORT_BRIDGES) {
        const abs = path.join(cwd, rel);
        if (!fs.existsSync(abs)) {
            issues.push(`Saknad obligatorisk brygga: ${rel}`);
            continue;
        }
        const body = fs.readFileSync(abs, 'utf8');
        if (!exportFromTsRe.test(body)) {
            issues.push(`Brygga saknar förväntad re-export till .ts: ${rel}`);
        }
    }
    return issues;
}

function bridge_body_for (js_rel) {
    const base = path.basename(js_rel, '.js');
    return `/**
 * Brygga: behåller import med .js-suffix (Vite extensionAlias + verify_js_only_imports).
 * Källan: ${base}.ts
 */
export * from './${base}.ts';
`;
}

function write_missing_bridges (cwd) {
    let written = 0;
    for (const rel of REQUIRED_JS_REEXPORT_BRIDGES) {
        const abs = path.join(cwd, rel);
        if (fs.existsSync(abs)) continue;
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, bridge_body_for(rel), 'utf8');
        written += 1;
        console.log(`Skrev brygga: ${rel}`);
    }
    return written;
}

const cwd = process.cwd();
const js_root = path.join(cwd, 'js');
const all_files = walk_source_files(js_root);
const js_only = all_files.filter((p) => p.endsWith('.js'));

const do_fix = process.argv.includes('--fix');
if (do_fix) {
    const n = write_missing_bridges(cwd);
    if (n === 0) console.log('Inga saknade bryggor att skriva.');
}

const issues_bridge = verify_required_bridges(cwd);
const issues_js_only = verify_js_importers_no_ts_only_targets(js_only, cwd);
const issues_resolve = verify_resolvable_relative_js(all_files, cwd);

const all_issues = [...issues_bridge, ...issues_js_only, ...issues_resolve];
if (all_issues.length) {
    console.error('verify_js_only_imports: fel hittades:\n' + all_issues.join('\n'));
    process.exit(1);
}

console.log(
    'OK: obligatoriska bryggor finns, inga .js-filer importerar endast-.ts-mål, alla relativa .js-importmål löser sig.'
);
