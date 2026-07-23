/**
 * Selektiv synk från lokal miljö till testservern (rör inte users-tabellen).
 *
 * Kör: npm run sync:test-server-from-local
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
    export_local_sync_payload,
    resolve_sync_dir,
} from './export-test-server-sync.mjs';

process.env.DEPLOY_PATH = process.env.DEPLOY_PATH || '/var/www/granskningsverktyget-test-server';
if (!process.env.DEPLOY_SSH_ALIAS && !process.env.DEPLOY_SSH_PASSWORD) {
    process.env.DEPLOY_SSH_ALIAS = 'granskning';
}
if (!process.env.DEPLOY_USER) process.env.DEPLOY_USER = 'localiliben';
if (!process.env.DEPLOY_SSH_HOSTNAME) {
    process.env.DEPLOY_SSH_HOSTNAME = 'ux-granskningsverktyg.pts.ad';
}

const {
    exec,
    putFile,
    putDirectory,
    disconnect,
    remotePath,
    projectRoot,
} = await import('./deploy-utils.js');

const TEST_DATABASE_URL =
    process.env.GV_TEST_SERVER_DATABASE_URL
    || 'postgresql://granskning:granskning@localhost:5432/granskningsverktyget_test';

async function upload_sync_bundle(sync_dir, audit_id) {
    const remote_sync_dir = `${remotePath}/.tmp-test-server-sync`;
    await exec(`mkdir -p ${remote_sync_dir}`, { cwd: false });
    await putFile(join(sync_dir, 'rule_sets.json'), `${remote_sync_dir}/rule_sets.json`);
    await putFile(join(sync_dir, 'netonnet_audit.json'), `${remote_sync_dir}/netonnet_audit.json`);

    const media_local = join(projectRoot, 'audit-media', audit_id);
    if (!existsSync(media_local)) {
        throw new Error(`Saknar audit-media/${audit_id}/ lokalt`);
    }

    await exec(`rm -rf ${remotePath}/audit-media/${audit_id}`, { cwd: false });
    await putDirectory(media_local, `${remotePath}/audit-media/${audit_id}`);
    console.log(`[sync] Laddade upp audit-media/${audit_id}/`);
}

async function run_remote_db_script(script_name, use_tsx = false) {
    const runner = use_tsx ? 'npx tsx' : 'node';
    const cmd = `DATABASE_URL=${TEST_DATABASE_URL} ${runner} ${script_name}`;
    await exec(cmd);
}

async function run_remote_import() {
    const remote_sync_dir = `${remotePath}/.tmp-test-server-sync`;
    await exec(`node scripts/import-test-server-sync.mjs ${remote_sync_dir}`, { cwd: true });
}

async function patch_test_audits() {
    console.log('\n[sync] Uppdaterar granskningstyper på testservern...');
    await run_remote_db_script('scripts/set_audit_types_by_case.mjs');
    console.log('\n[sync] Uppdaterar bristtyper i granskningssnapshots på testservern...');
    await run_remote_db_script('scripts/apply_deficiency_types_to_audits.mjs', true);
}

async function main() {
    try {
        const sync_dir = resolve_sync_dir(projectRoot);
        console.log('[sync:test-server-from-local] Exporterar från lokal databas...');
        const { audit_id } = await export_local_sync_payload(projectRoot, sync_dir);

        console.log('[sync:test-server-from-local] Laddar upp till testservern...');
        await upload_sync_bundle(sync_dir, audit_id);

        console.log('[sync:test-server-from-local] Importerar till test-databas...');
        await run_remote_import();
        await patch_test_audits();

        console.log('[sync:test-server-from-local] Klart (users-tabellen oförändrad).');
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error('[sync:test-server-from-local] Fel:', err.message);
    process.exit(1);
});
