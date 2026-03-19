#!/usr/bin/env node
import { watch, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get_latest_project_mtime } from './compute-latest-mtime.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const buildInfoPath = join(projectRoot, 'build-info.js');

const DEBOUNCE_MS = 150;

let debounce_timer = null;
/** Undvik att skriva samma innehåll igen – annars uppdateras mtime och Vite triggar HMR/omladdning i loop (särskilt på Windows). */
let last_written_content = null;

function format_build_info_from_mtime(mtime) {
    const buildTime = mtime || new Date();
    const swedishOptions = { timeZone: 'Europe/Stockholm' };
    return {
        timestamp: buildTime.toISOString(),
        date: buildTime.toLocaleDateString('sv-SE', swedishOptions),
        time: buildTime.toLocaleTimeString('sv-SE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Stockholm',
        }),
    };
}

function write_build_info_file(buildInfo) {
    const content = `// Auto-generated build info (dev – uppdateras vid filändring)
window.BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};
`;
    if (content === last_written_content) {
        return false;
    }
    last_written_content = content;
    writeFileSync(buildInfoPath, content, 'utf8');
    return true;
}

function update_build_info() {
    try {
        const latestMtime = get_latest_project_mtime({
            rootDir: projectRoot,
            excludeDirs: ['dist'],
        });

        if (!latestMtime) return;

        const buildInfo = format_build_info_from_mtime(latestMtime);
        const did_write = write_build_info_file(buildInfo);
        if (did_write) {
            console.log(`[BUILDINFO] Senaste dev: ${buildInfo.date} kl ${buildInfo.time}`);
        }
    } catch (error) {
        console.warn('[BUILDINFO] Kunde inte uppdatera build-info.js:', error.message);
    }
}

function schedule_update() {
    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(() => {
        debounce_timer = null;
        update_build_info();
    }, DEBOUNCE_MS);
}

// Skapa/uppdatera vid start
update_build_info();

// Bevaka filändringar (samma som Vite ser) – ingen polling
watch(projectRoot, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.includes('node_modules') || filename.includes('dist') || filename.includes('.git')) return;
    if (filename && filename.replace(/\\/g, '/').endsWith('build-info.js')) return;
    schedule_update();
});

console.log('[BUILDINFO] Bevakar filändringar – uppdaterar vid ändring (ingen polling)');
