/**
 * @fileoverview CI-/lokal kontroll: varnar om en .js-fil under js/ importerar `*.js`
 * mot en modul som bara finns som `.ts` (samma klass av Vite-404 som vid blandad migrering).
 * Kör via `npm run check:js-ts-imports` (ingår i `npm run check`).
 */
import fs from 'fs';
import path from 'path';

const importRe = /(?:from|import)\s+['"](\.\.?\/[^'"]+\.js)['"]/g;

function walkJs (dir, acc = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        if (e.isDirectory()) walkJs(p, acc);
        else if (e.name.endsWith('.js')) acc.push(p);
    }
    return acc;
}

const root = path.join(process.cwd(), 'js');
const issues = [];

for (const filePath of walkJs(root)) {
    const text = fs.readFileSync(filePath, 'utf8');
    importRe.lastIndex = 0;
    let m;
    while ((m = importRe.exec(text)) !== null) {
        const spec = m[1];
        const resolved = path.normalize(path.join(path.dirname(filePath), spec));
        const jsPath = resolved;
        const tsPath = resolved.slice(0, -3) + '.ts';
        if (!fs.existsSync(jsPath) && fs.existsSync(tsPath)) {
            issues.push(`${filePath.replace(process.cwd() + path.sep, '')}: ${spec}`);
        }
    }
}

if (issues.length) {
    console.error('JS-importer till saknad .js (finns .ts):\n' + issues.join('\n'));
    process.exit(1);
}
console.log('OK: inga .js-filer importerar .js-suffix mot endast-.ts-mål.');
