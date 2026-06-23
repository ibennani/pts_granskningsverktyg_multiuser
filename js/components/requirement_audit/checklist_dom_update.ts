/**
 * @fileoverview DOM-uppdatering och heal-synk för ChecklistHandler — barrel-export.
 */

export type {
    ChecklistDomUpdateHost,
    DomUpdateEnv,
    DomUpdatePatchScope,
    HealPcEnv,
    HealPcParams
} from './checklist_dom_update_types.js';

export { heal_pc_ui_from_data, heal_all_checklist_ui_from_data } from './checklist_dom_update_heal.js';

export { update_dom_single_pass_criterion_item } from './checklist_dom_update_pass_criterion.js';

export {
    update_dom_single_check_wrapper,
    update_dom_check_and_pass_criteria,
    update_dom_full,
    update_dom_stuck_button
} from './checklist_dom_update_check_wrapper.js';

import { reapply_pending_status_button_focus } from './checklist_status_button_ui.js';
import { heal_all_checklist_ui_from_data } from './checklist_dom_update_heal.js';
import {
    update_dom_check_and_pass_criteria,
    update_dom_full,
    update_dom_single_check_wrapper
} from './checklist_dom_update_check_wrapper.js';
import type { ChecklistDomUpdateHost } from './checklist_dom_update_types.js';

export function update_dom(host: ChecklistDomUpdateHost): void {
    const patch_scope = host._patch_scope || null;
    if (patch_scope?.mode === 'pc_only' && patch_scope.check_id && patch_scope.pc_id) {
        const check_wrapper = host.container_ref?.querySelector(
            `.check-item[data-check-id="${CSS.escape(String(patch_scope.check_id))}"]`
        ) as HTMLElement | null;
        if (check_wrapper) {
            update_dom_single_check_wrapper(host, check_wrapper, patch_scope.pc_id, {
                force_status_button_sync: true
            });
        }
        heal_all_checklist_ui_from_data(host, 'after_update_dom_pc_only');
        reapply_pending_status_button_focus(host);
        return;
    }
    if (patch_scope?.mode === 'check_and_pcs' && patch_scope.check_id) {
        update_dom_check_and_pass_criteria(host, patch_scope.check_id);
        heal_all_checklist_ui_from_data(host, 'after_update_dom_check_and_pcs');
        reapply_pending_status_button_focus(host);
        return;
    }
    update_dom_full(host);
    heal_all_checklist_ui_from_data(host, 'after_update_dom_full');
    reapply_pending_status_button_focus(host);
}

export { update_dom_pc_only } from './checklist_dom_update_pass_criterion.js';
