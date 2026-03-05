#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get_latest_project_mtime } from './compute-latest-mtime.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const buildInfoPath = join(projectRoot, 'build-info.js');

const POLL_INTERVAL_MS = 5000;

let lastTimestampIso = null;

function format_build_info_from_mtime(mtime) {
    const buildTime = mtime || new Date();
    return {
        timestamp: buildTime.toISOString(),
        date: buildTime.toLocaleDateString('sv-SE'),
        time: buildTime.toLocaleTimeString('sv-SE', {
            hour: '2-digit',
            minute: '2-digit',
        }),
    };
}

function write_build_info_file(buildInfo) {
    const content = `// Auto-generated build info (dev watcher)
window.BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};
`;
    writeFileSync(buildInfoPath, content, 'utf8');
}

function update_build_info_once() {
    try {
        const latestMtime = get_latest_project_mtime({
            rootDir: projectRoot,
            excludeDirs: ['dist'],
        });

        if (!latestMtime) {
            return;
        }

        const buildInfo = format_build_info_from_mtime(latestMtime);

        if (buildInfo.timestamp === lastTimestampIso) {
            return;
        }

        lastTimestampIso = buildInfo.timestamp;
        write_build_info_file(buildInfo);
        console.log(
            `[dev-build-info-watcher] Uppdaterade build-info.js till senast ändrad fil: ${buildInfo.date} kl ${buildInfo.time}`
        );
    } catch (error) {
        console.warn('[dev-build-info-watcher] Kunde inte uppdatera build-info.js:', error.message);
    }
}

console.log('[dev-build-info-watcher] Startar bevakning av senaste filändring...');
update_build_info_once();
setInterval(update_build_info_once, POLL_INTERVAL_MS);

