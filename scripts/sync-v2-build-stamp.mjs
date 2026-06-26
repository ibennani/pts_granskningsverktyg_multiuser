#!/usr/bin/env node
/**
 * Synkar build-info.js och byggtext längst ner på fjärr-v2.
 * Använd efter rollback-deploy när byggtiden ska matcha ursprunglig release (inte dagens build).
 *
 *   node scripts/sync-v2-build-stamp.mjs
 *   node scripts/sync-v2-build-stamp.mjs --till=2026-06-09T17:06:00.000Z
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format_build_info_object } from '../js/utils/build_time_format.js';
import { exec, putFile, disconnect, remotePath, getSshClient } from './deploy-utils.js';

const till_arg = process.argv.find((a) => a.startsWith('--till='));
const at = till_arg
    ? new Date(till_arg.slice('--till='.length).trim())
    : new Date('2026-06-09T17:06:00.000Z'); // prod-deploy fefe0a93 ca 19:06 CEST

if (Number.isNaN(at.getTime())) {
    console.error('[sync-v2-build-stamp] Ogiltigt --till= datum');
    process.exit(1);
}

const build_info = format_build_info_object(at, { include_seconds: false });
const cache_bust = String(new Date(build_info.timestamp).getTime());
const build_info_body = `// Fryst bygginfo – synkad efter rollback-deploy
window.BUILD_INFO = ${JSON.stringify(build_info, null, 2)};
`;

const tmp_dir = join(dirname(fileURLToPath(import.meta.url)), '..', '.tmp-v2-build-stamp');
mkdirSync(tmp_dir, { recursive: true });
const local_build_info = join(tmp_dir, 'build-info.js');
writeFileSync(local_build_info, build_info_body, 'utf8');

const remote_root = remotePath.replace(/\\/g, '/').replace(/\/+$/, '');
const remote_build_info = `${remote_root}/build-info.js`;
const remote_index = `${remote_root}/index.html`;

async function fetch_remote_index_html() {
    const rp = remote_root.replace(/'/g, "'\\''");
    const inner = `cat ${JSON.stringify(remote_index)}`;
    const client = await getSshClient();
    const r = await client.execCommand(`bash -l -c ${JSON.stringify(inner)}`, { cwd: '/' });
    if (r.code !== 0 || !r.stdout) {
        throw new Error('Kunde inte läsa index.html på servern');
    }
    return r.stdout;
}

function patch_index_html(html) {
    let out = html;
    out = out.replace(/<script id="gv_v2_sw_reset[^"]*">[\s\S]*?<\/script>/g, '');
    out = out.replace(/<\/head><\/head>/g, '</head>');
    out = out.replace(
        /<div id="build-timestamp"[^>]*>[\s\S]*?<\/div>/,
        '<div id="build-timestamp" aria-hidden="true"></div>'
    );
    const build_info_tag = `<script type="module" src="build-info.js?v=${cache_bust}"></script>`;
    if (!/src="build-info\.js/.test(out)) {
        out = out.replace(
            /(<!-- Build info \(generated under build\) -->)/,
            `$1\n    ${build_info_tag}`
        );
        if (!/src="build-info\.js/.test(out)) {
            out = out.replace(
                /(<script type="module" crossorigin src="\/v2\/assets\/main-)/,
                `    ${build_info_tag}\n  $1`
            );
        }
    } else {
        out = out.replace(
            /src="build-info\.js[^"]*"/,
            `src="build-info.js?v=${cache_bust}"`
        );
    }
    return out;
}

try {
    console.info(`[sync-v2-build-stamp] Sätter byggtid till ${build_info.date} kl ${build_info.time}…`);
    await putFile(local_build_info, remote_build_info);

    const index_html = await fetch_remote_index_html();
    const patched = patch_index_html(index_html);
    const local_index = join(tmp_dir, 'index.html');
    writeFileSync(local_index, patched, 'utf8');
    await putFile(local_index, remote_index);

    console.info('[sync-v2-build-stamp] build-info.js och index.html uppdaterade på v2.');
} finally {
    await disconnect();
    try {
        unlinkSync(local_build_info);
        unlinkSync(join(tmp_dir, 'index.html'));
    } catch {
        /* ignore */
    }
}
