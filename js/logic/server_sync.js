// js/logic/server_sync.js
// Debounced sync av state till server. Om auditId saknas importeras granskningen först.
// Vid regelfilsredigering synkas innehållet till rule_sets så att updated_at = senast ändrad.

import { enqueue_rulefile_part_patch as enqueue_rulefile_part_patch_to_queue } from '../sync/rulefile_patch_queue.js';
export { schedule_sync_to_server, sync_to_server_now, flush_sync_to_server } from '../sync/audit_sync_service.js';
export { schedule_sync_rulefile_to_server, flush_sync_rulefile_to_server } from '../sync/rulefile_sync_service.js';

// Audit-sync hanteras i js/sync/audit_sync_service.js

/**
 * Köar en del-uppdatering av regelfilen. Används av fältkomponenter för autospar per fält.
 * Själva nätverksanropet görs av existerande debounced schedule_sync_rulefile_to_server().
 * @param {{ part_key: string, value: string }} patch
 */
export function enqueue_rulefile_part_patch(patch) {
    if (typeof window === 'undefined') return;
    if (!patch || typeof patch.part_key !== 'string') return;
    enqueue_rulefile_part_patch_to_queue({
        part_key: patch.part_key,
        value: typeof patch.value === 'string' ? patch.value : String(patch.value ?? '')
    });
}
