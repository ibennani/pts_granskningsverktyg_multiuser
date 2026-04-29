import { update_rule, patch_rule_content_part } from '../api/client.js';
import { notify_rules_list_changed } from '../logic/list_push_service.js';
import {
    clear_rulefile_sync_pending,
    is_fetch_network_error,
    mark_rulefile_sync_pending,
    notify_network_unreachable_for_sync
} from '../logic/connectivity_service.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { update_rulefile_baseline_from_remote } from '../logic/rulefile_collaboration_notice.js';
import { drain_rulefile_patch_queue } from './rulefile_patch_queue.js';

let rulefile_debounce_timer = null;
const RULEFILE_DEBOUNCE_MS = 500;

async function run_sync_rulefile(state, dispatch_fn) {
    if (!state?.ruleSetId || !state?.ruleFileContent || typeof window === 'undefined') return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        mark_rulefile_sync_pending();
        notify_network_unreachable_for_sync();
        return;
    }

    try {
        // Om det finns en pending patch-queue använder vi del-sparning i stället för hel PUT.
        const to_send = drain_rulefile_patch_queue();
        if (to_send.length > 0) {
            const base_version = Number(state?.ruleFileServerVersion ?? 0);
            for (const p of to_send) {
                if (!p?.part_key) continue;
                await patch_rule_content_part(state.ruleSetId, {
                    part_key: String(p.part_key),
                    base_version,
                    value: typeof p.value === 'string' ? p.value : String(p.value ?? '')
                });
            }
            clear_rulefile_sync_pending();
            notify_rules_list_changed();
            return;
        }

        const updated = await update_rule(state.ruleSetId, { content: state.ruleFileContent });
        if (updated?.content && typeof dispatch_fn === 'function') {
            dispatch_fn({
                type: 'REPLACE_RULEFILE_FROM_REMOTE',
                payload: {
                    ruleFileContent: updated.content,
                    version: updated.version
                }
            });
        }
        if (updated?.content) {
            update_rulefile_baseline_from_remote(state.ruleSetId, updated.content);
        }
        clear_rulefile_sync_pending();
        notify_rules_list_changed();
    } catch (err) {
        if (is_fetch_network_error(err)) {
            mark_rulefile_sync_pending();
            notify_network_unreachable_for_sync();
            return;
        }
        if (err.status === 401) {
            return;
        }
        mark_rulefile_sync_pending();
        if (app_runtime_refs.notification_component?.show_global_message && window.Translation?.t) {
            app_runtime_refs.notification_component.show_global_message(
                window.Translation.t('server_sync_error', { message: err.message }) || `Kunde inte spara regelfilen: ${err.message}`,
                'error'
            );
        }
    }
}

/**
 * Schemalägg debounced sparande av regelfilinnehåll till servern.
 * Anropas vid UPDATE_RULEFILE_CONTENT när användaren redigerar regelfil (metadata, krav, etc.).
 * Serverns updated_at och metadata.dateModified blir då "senast ändrad (något redigerbart)".
 * @param {function} get_state_fn - Funktion som returnerar aktuell state (anropas när timern går).
 * @param {function} [dispatch_fn] - Om angiven anropas efter lyckad sync med serverns svar så att state får uppdaterad dateModified.
 */
export function schedule_sync_rulefile_to_server(get_state_fn, dispatch_fn) {
    if (typeof get_state_fn !== 'function' || typeof window === 'undefined') return;

    if (rulefile_debounce_timer) clearTimeout(rulefile_debounce_timer);
    rulefile_debounce_timer = setTimeout(async () => {
        rulefile_debounce_timer = null;
        const state = get_state_fn();
        // Synka aldrig publicerad regelfil – endast arbetskopior ska uppdateras automatiskt.
        if (state?.ruleFileIsPublished) return;
        if (state?.auditStatus === 'rulefile_editing' && state.ruleSetId && state.ruleFileContent) {
            await run_sync_rulefile(state, dispatch_fn);
        }
    }, RULEFILE_DEBOUNCE_MS);
}

/**
 * Sparar regelfilinnehåll till servern omedelbart (t.ex. vid navigering bort från redigeringsvyn).
 * @param {function} get_state_fn - Funktion som returnerar aktuell state.
 * @param {function} [dispatch_fn] - Om angiven anropas efter lyckad sync med serverns svar så att state får uppdaterad dateModified.
 */
export async function flush_sync_rulefile_to_server(get_state_fn, dispatch_fn) {
    if (rulefile_debounce_timer) {
        clearTimeout(rulefile_debounce_timer);
        rulefile_debounce_timer = null;
    }
    const state = typeof get_state_fn === 'function' ? get_state_fn() : null;
    // Synka aldrig publicerad regelfil – endast arbetskopior ska uppdateras.
    if (state?.ruleFileIsPublished) return;
    if (state?.auditStatus === 'rulefile_editing' && state.ruleSetId && state.ruleFileContent) {
        await run_sync_rulefile(state, dispatch_fn);
    }
}

