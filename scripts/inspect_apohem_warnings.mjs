#!/usr/bin/env node
/**
 * Hämtar warnings_json och analyserar network.json i en Apohem-sidrapport på testservern.
 */
import { exec, disconnect } from './deploy-utils.js';

async function main() {
    const audit_id = 'd2029bf0-538a-40e1-916d-cc0ae266012b';
    try {
        console.log('=== warnings_json (ready) ===');
        await exec(
            `docker exec granskningsverktyget-db psql -U granskning -d granskningsverktyget_test -t -A -c "SELECT id, warning_count, warnings_json::text FROM audit_snapshots WHERE audit_id = '${audit_id}' AND status = 'ready' ORDER BY created_at DESC LIMIT 5;"`
        );

        console.log('\n=== Snapshot-arkivsökvägar ===');
        await exec(
            `ssh localiliben@ux-granskningsverktyg.pts.ad 'ls -la /var/www/granskningsverktyget-test-server/data/audit-snapshots/${audit_id}/ 2>/dev/null | tail -5 || ls -la /var/www/granskningsverktyget-test-server/server/data/audit-snapshots/${audit_id}/ 2>/dev/null | tail -5 || find /var/www/granskningsverktyget-test-server -path "*${audit_id}*" -name "*.zip" 2>/dev/null | head -3'`
        );

        console.log('\n=== Analysera network.json i senaste ready zip ===');
        await exec(
            `ssh localiliben@ux-granskningsverktyg.pts.ad 'SNAP_ID=$(docker exec granskningsverktyget-db psql -U granskning -d granskningsverktyget_test -t -A -c "SELECT id FROM audit_snapshots WHERE audit_id = '\''${audit_id}'\'' AND status = '\''ready'\'' ORDER BY created_at DESC LIMIT 1;"); echo SNAP=$SNAP_ID; for base in /var/www/granskningsverktyget-test-server/data/audit-snapshots /var/www/granskningsverktyget-test-server/server/data/audit-snapshots; do ZIP="$base/${audit_id}/$SNAP_ID.zip"; if [ -f "$ZIP" ]; then echo ZIP=$ZIP; unzip -p "$ZIP" network.json | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0,'utf8')); const r=d.resources||[]; const skip=r.filter(x=>x.bodySkipReason); const captured=r.filter(x=>x.bodyCaptured); console.log(JSON.stringify({total:r.length,captured:captured.length,skipped:skip.length,skipReasons:skip.slice(0,5).map(x=>({url:x.url.slice(0,80),type:x.resourceType,mime:x.mimeType,reason:x.bodySkipReason})),failed:r.filter(x=>x.failed).length},null,2));"; break; fi; done'`
        );
    } finally {
        await disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
