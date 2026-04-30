/**
 * @fileoverview Word-export: huvudflöde (krav- respektive stickprovssortering).
 */
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import {
    append_word_export_intro_paragraphs,
    append_word_export_body_sorted_by_requirements,
    append_word_export_body_sorted_by_samples,
    type ExportWordMainFlowT
} from './export_word_main_flow_children.js';
import { finalize_word_export_download } from './export_word_main_flow_document.js';

// sortBy kan vara 'requirements' (sorterar på krav) eller 'samples' (sorterar på stickprov)
export async function export_to_word_wrapper (current_audit: any, sortBy: any) {
    const t = get_t_internal() as ExportWordMainFlowT;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const isSortByRequirements = sortBy === 'requirements';
    consoleManager.log(`[Word Export] Starting export_to_word_wrapper with sortBy=${sortBy}`);

    try {
        const children: unknown[] = [];
        append_word_export_intro_paragraphs(children, t);
        if (isSortByRequirements) {
            append_word_export_body_sorted_by_requirements(children, current_audit, t);
        } else {
            append_word_export_body_sorted_by_samples(children, current_audit, t);
        }
        await finalize_word_export_download({ children, current_audit, isSortByRequirements, t });
    } catch (error: unknown) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('Error exporting to Word:', error);
        const msg = error instanceof Error ? error.message : String(error);
        show_global_message_internal(t('error_exporting_word') + ` ${msg}`, 'error');
    }
}

export async function export_to_word_criterias (current_audit: any) {
    return await export_to_word_wrapper(current_audit, 'requirements');
}

export async function export_to_word_samples (current_audit: any) {
    return await export_to_word_wrapper(current_audit, 'samples');
}
