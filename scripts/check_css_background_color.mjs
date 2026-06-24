/**
 * Förhindrar att --background-color får gradient/url (ogiltigt i background-color).
 * Endast --page-background får gradient; --background-color ska vara solid <color>.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const THEME_FILES = [
    path.join(root, 'css', 'style.css'),
    ...fs.readdirSync(path.join(root, 'css'))
        .filter((name) => name.startsWith('theme-') && name.endsWith('.css'))
        .map((name) => path.join(root, 'css', name)),
];

const GRADIENT_OR_URL = /\b(gradient|url)\s*\(/i;
const BACKGROUND_COLOR_DEF = /--background-color\s*:\s*([^;]+);/g;
const BACKGROUND_COLOR_USES_PAGE = /background-color\s*:[^;]*var\(\s*--page-background\s*\)/;
const COLOR_MIX_USES_PAGE = /color-mix\s*\([^)]*var\(\s*--page-background\s*\)/;

function collect_css_files(dir, acc = []) {
    if (!fs.existsSync(dir)) {
        return acc;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collect_css_files(full, acc);
        } else if (entry.name.endsWith('.css')) {
            acc.push(full);
        }
    }
    return acc;
}

const COMPONENT_CSS_DIRS = [
    path.join(root, 'css'),
    path.join(root, 'js', 'components'),
];

let failed = false;

function report_error(message) {
    console.error(`[check-css-background-color] ${message}`);
    failed = true;
}

for (const file_path of THEME_FILES) {
    const content = fs.readFileSync(file_path, 'utf8');
    for (const match of content.matchAll(BACKGROUND_COLOR_DEF)) {
        const value = match[1].trim();
        if (GRADIENT_OR_URL.test(value)) {
            report_error(
                `${path.relative(root, file_path)}: --background-color får inte innehålla gradient/url (värde: ${value.slice(0, 60)}…)`
            );
        }
    }
}

for (const dir of COMPONENT_CSS_DIRS) {
    for (const file_path of collect_css_files(dir)) {
        if (THEME_FILES.includes(file_path)) {
            continue;
        }
        const content = fs.readFileSync(file_path, 'utf8');
        if (BACKGROUND_COLOR_USES_PAGE.test(content)) {
            report_error(
                `${path.relative(root, file_path)}: background-color får inte referera --page-background (använd solid token)`
            );
        }
        if (COLOR_MIX_USES_PAGE.test(content)) {
            report_error(
                `${path.relative(root, file_path)}: color-mix får inte referera --page-background`
            );
        }
    }
}

if (failed) {
    process.exit(1);
}

console.log('[check-css-background-color] OK (--background-color är solid i temafiler).');
