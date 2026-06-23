/**
 * @fileoverview Input-hantering för observations-textarea i ChecklistHandler.
 */

import { log_krav_vy_textarea } from './krav_vy_knapp_debug_log.js';
import type { ChecklistEventHandlerHost } from './checklist_event_handler_types.js';

export function handle_textarea_input(host: ChecklistEventHandlerHost, event: Event): void {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    if (!textarea.classList.contains('pc-observation-detail-textarea')) return;

    const pc_item = textarea.closest('.pass-criterion-item[data-pc-id]');
    const check_item = textarea.closest('.check-item[data-check-id]');
    if (!pc_item || !check_item || !host.requirement_result_ref?.checkResults) return;

    const check_id = (check_item as HTMLElement).dataset.checkId!;
    const pc_id = (pc_item as HTMLElement).dataset.pcId!;
    host._set_pc_observation_detail(
        host.requirement_result_ref.checkResults,
        check_id,
        pc_id,
        textarea.value ?? ''
    );
    if (event.type === 'input') {
        log_krav_vy_textarea('Textarea input (lokal state)', {
            fält: 'Observation',
            check_id,
            pc_id,
            värde_längd: (textarea.value || '').length
        });
        if (host.on_observation_change_callback) {
            host.on_observation_change_callback();
        }
    }
}
