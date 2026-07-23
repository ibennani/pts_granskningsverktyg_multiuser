/**
 * Förbereder lokal databas inför selektiv synk till testservern.
 *
 * Kör: npm run prepare:test-server-sync
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const project_root = join(__dirname, '..');

function run_step(label, command, args) {
    console.log(`\n[prepare:test-server-sync] ${label}...`);
    const result = spawnSync(command, args, {
        cwd: project_root,
        stdio: 'inherit',
        shell: false,
    });
    if (result.status !== 0) {
        throw new Error(`${label} misslyckades (kod ${result.status})`);
    }
}

function main() {
    run_step('Bristtyper i regelfiler', 'npx', ['tsx', 'scripts/apply_deficiency_types.mjs']);
    run_step('Granskningstyper per ärende', 'node', ['scripts/set_audit_types_by_case.mjs']);
    run_step('Bristtyper i granskningssnapshots', 'npx', [
        'tsx',
        'scripts/apply_deficiency_types_to_audits.mjs',
    ]);
    console.log('\n[prepare:test-server-sync] Lokal förberedelse klar.');
}

main();
