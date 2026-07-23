/**
 * Full pipeline: förbered lokalt → deploy kod → selektiv datasynk till testservern.
 *
 * Kör: npm run publish:test-server-from-local
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const project_root = join(__dirname, '..');

function run_npm(script_name) {
    console.log(`\n[publish:test-server-from-local] npm run ${script_name}...`);
    const result = spawnSync('npm', ['run', script_name], {
        cwd: project_root,
        stdio: 'inherit',
        shell: false,
    });
    if (result.status !== 0) {
        throw new Error(`npm run ${script_name} misslyckades (kod ${result.status})`);
    }
}

function main() {
    run_npm('prepare:test-server-sync');
    run_npm('deploy:test-server');
    run_npm('sync:test-server-from-local');
    console.log('\n[publish:test-server-from-local] Allt klart.');
}

main();
