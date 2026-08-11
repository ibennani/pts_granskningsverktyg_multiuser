/**
 * @fileoverview Verifierar att alla språkfiler har samma nycklar och icke-tomma värden.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const i18n_dir = path.join(root, 'js', 'i18n');

const LOCALE_FILES = ['sv-SE.json', 'en-GB.json', 'nb-NO.json'];

let failed = false;

function report_error(message) {
    console.error(`[check-i18n-parity] ${message}`);
    failed = true;
}

const locale_data = Object.fromEntries(
    LOCALE_FILES.map((filename) => {
        const file_path = path.join(i18n_dir, filename);
        const parsed = JSON.parse(fs.readFileSync(file_path, 'utf8'));
        return [filename, parsed];
    })
);

const all_keys = new Set();
for (const filename of LOCALE_FILES) {
    Object.keys(locale_data[filename]).forEach((key) => all_keys.add(key));
}

for (const key of [...all_keys].sort()) {
    for (const filename of LOCALE_FILES) {
        const value = locale_data[filename][key];
        if (!(key in locale_data[filename])) {
            report_error(`Nyckel saknas i ${filename}: ${key}`);
            continue;
        }
        if (typeof value !== 'string') {
            report_error(`Nyckel ${key} i ${filename} är inte en sträng`);
            continue;
        }
        if (!value.trim()) {
            report_error(`Tomt värde i ${filename}: ${key}`);
        }
    }
}

const counts = Object.fromEntries(LOCALE_FILES.map((f) => [f, Object.keys(locale_data[f]).length]));
console.log(`[check-i18n-parity] ${all_keys.size} nycklar, antal per fil: ${JSON.stringify(counts)}`);

if (failed) {
    process.exit(1);
}

console.log('[check-i18n-parity] OK');
