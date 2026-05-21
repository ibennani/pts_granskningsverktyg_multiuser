/**
 * @fileoverview Avvisar PATCH som skulle skriva äldre kravinnehåll över nyare data på servern.
 */

import { get_latest_requirement_status_update_iso } from '../../js/logic/audit_sync_tracking.js';

/**
 * True om inkommande stickprov har äldre senaste kravändring än befintlig rad.
 */
export function is_incoming_audit_samples_older_than_existing(
    existing_samples: unknown,
    incoming_samples: unknown
): boolean {
    const existing_iso = get_latest_requirement_status_update_iso({ samples: existing_samples as never });
    const incoming_iso = get_latest_requirement_status_update_iso({ samples: incoming_samples as never });
    if (!existing_iso || !incoming_iso) return false;
    return incoming_iso < existing_iso;
}
