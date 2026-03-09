// js/logic/server_sync.js
// Debounced sync av state till server. Om auditId saknas importeras granskningen först.
// Vid regelfilsredigering synkas innehållet till rule_sets så att updated_at = senast ändrad.

import { update_audit, import_audit, update_rule } from '../api/client.js';

let debounce_timer = null;
let rulefile_debounce_timer = null;
const DEBOUNCE_MS = 500;
const RULEFILE_DEBOUNCE_MS = 500;

const SERVER_STATUS_VALUES = ['not_started', 'in_progress', 'locked', 'archived'];

function normalize_status_for_server(status) {
    if (SERVER_STATUS_VALUES.includes(status)) return status;
    return 'not_started';
}

function state_to_patch(state) {
    const patch = {
        metadata: state.auditMetadata || {},
        status: normalize_status_for_server(state.auditStatus || 'not_started'),
        samples: state.samples || []
    };
    // Inkludera regelfilinnehåll så att \"Uppdatera regelfil\" och liknande persisteras i audits.rule_file_content
    if (state.ruleFileContent) {
        patch.ruleFileContent = state.ruleFileContent;
    }
    if (Array.isArray(state.archivedRequirementResults)) {
        patch.archivedRequirementResults = state.archivedRequirementResults;
    }
    return patch;
}

function state_to_import(state) {
    return {
        ruleFileContent: state.ruleFileContent,
        auditMetadata: state.auditMetadata || {},
        auditStatus: normalize_status_for_server(state.auditStatus || 'not_started'),
        samples: state.samples || []
    };
}

function count_stuck_in_samples(samples) {
    if (!Array.isArray(samples)) return 0;
    let n = 0;
    samples.forEach((sample) => {
        const results = sample?.requirementResults || {};
        Object.values(results).forEach((r) => {
            const t = (r?.stuckProblemDescription || '').trim();
            if (t !== '') n += 1;
        });
    });
    return n;
}

function show_audit_deleted_modal_and_navigate() {
    if (typeof window === 'undefined') return;
    if (window.__GV_AUDIT_DELETED_MODAL_SHOWN__) return;
    window.__GV_AUDIT_DELETED_MODAL_SHOWN__ = true;

    const ModalComponent = window.ModalComponent;
    const Helpers = window.Helpers;
    const t = window.Translation?.t || ((key) => key);

    if (!ModalComponent?.show || !Helpers?.create_element) {
        const NotificationComponent = window.NotificationComponent;
        if (NotificationComponent?.show_global_message) {
            NotificationComponent.show_global_message(
                t('audit_deleted_modal_message_fallback'),
                'error'
            );
        }
        try {
            window.location.hash = '#audit_audits';
        } catch (_) {}
        return;
    }

    ModalComponent.show(
        {
            h1_text: t('audit_deleted_modal_title'),
            message_text: t('audit_deleted_modal_message')
        },
        (container, modal_instance) => {
            const buttons_wrapper = Helpers.create_element('div', { class_name: 'modal-confirm-actions' });
            const ok_btn = Helpers.create_element('button', {
                class_name: ['button', 'button-primary'],
                text_content: t('audit_deleted_modal_understand_button')
            });
            ok_btn.addEventListener('click', () => {
                modal_instance.close();
                try {
                    window.location.hash = '#audit_audits';
                } catch (_) {}
            });
            buttons_wrapper.appendChild(ok_btn);
            container.appendChild(buttons_wrapper);
        }
    );
}

async function run_sync(state, dispatch_fn) {
    if (!state || !state.ruleFileContent || typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') return;

    try {
        if (state.auditId) {
            const patch = state_to_patch(state);
            const stuck_count = count_stuck_in_samples(patch.samples);
            if (window.__GV_DEBUG_STUCK_SYNC__) {
                console.log('[GV-Debug] run_sync: skickar PATCH till servern,', stuck_count, 'kört-fast i payload, auditId:', state.auditId);
            }
            const full_state = await update_audit(state.auditId, patch);
            if (window.__GV_DEBUG_STUCK_SYNC__) {
                console.log('[GV-Debug] run_sync: PATCH lyckades, version:', full_state?.version);
            }
            try {
                if (typeof BroadcastChannel !== 'undefined') {
                    const ch = new BroadcastChannel('granskningsverktyget-audit-updates');
                    ch.postMessage({ type: 'audit-updated', auditId: state.auditId });
                    ch.close();
                }
            } catch (_) {}
            if (dispatch_fn && full_state && full_state.version != null) {
                dispatch_fn({
                    type: 'SET_REMOTE_AUDIT_ID',
                    payload: {
                        auditId: state.auditId,
                        ruleSetId: state.ruleSetId ?? full_state.ruleSetId ?? null,
                        version: full_state.version,
                        skip_render: true
                    }
                });
            }
        } else {
            const full_state = await import_audit(state_to_import(state));
            try {
                if (full_state?.auditId && typeof BroadcastChannel !== 'undefined') {
                    const ch = new BroadcastChannel('granskningsverktyget-audit-updates');
                    ch.postMessage({ type: 'audit-updated', auditId: full_state.auditId });
                    ch.close();
                }
            } catch (_) {}
            if (dispatch_fn && full_state?.auditId) {
                setTimeout(() => {
                    dispatch_fn({
                        type: 'SET_REMOTE_AUDIT_ID',
                        payload: {
                            auditId: full_state.auditId,
                            ruleSetId: full_state.ruleSetId ?? null,
                            version: full_state.version ?? null,
                            skip_render: true
                        }
                    });
                }, 0);
            }
        }
    } catch (err) {
        if (window.__GV_DEBUG_STUCK_SYNC__) {
            console.warn('[GV-Debug] run_sync: PATCH misslyckades', err?.message || err, err);
        }
        if (err.status === 409 && err.existingAuditId && dispatch_fn) {
            dispatch_fn({
                type: 'SET_REMOTE_AUDIT_ID',
                payload: {
                    auditId: err.existingAuditId,
                    ruleSetId: null,
                    version: null,
                    skip_render: true
                }
            });
        } else if (err.status === 404 && err.message && err.message.toLowerCase().includes('granskning hittades inte')) {
            show_audit_deleted_modal_and_navigate();
        } else if (window.NotificationComponent?.show_global_message && window.Translation?.t) {
            window.NotificationComponent.show_global_message(
                window.Translation.t('server_sync_error', { message: err.message }) || `Kunde inte spara till servern: ${err.message}`,
                'error'
            );
        }
    }
}

async function run_sync_rulefile(state, dispatch_fn) {
    if (!state?.ruleSetId || !state?.ruleFileContent || typeof window === 'undefined') return;
    try {
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
    } catch (err) {
        if (window.NotificationComponent?.show_global_message && window.Translation?.t) {
            window.NotificationComponent.show_global_message(
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

export function schedule_sync_to_server(state, dispatch_fn) {
    if (!state) return;
    if (!state.ruleFileContent) return;
    if (typeof window === 'undefined') return;
    if (state.auditStatus === 'rulefile_editing') return;

    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(async () => {
        debounce_timer = null;
        await run_sync(state, dispatch_fn);
    }, DEBOUNCE_MS);
}

/**
 * Kör omedelbar sync till server med aktuell state (t.ex. vid "Fortsätt till stickprov").
 * Används när state.js inte triggar sync automatiskt (t.ex. auditStatus not_started).
 */
export async function sync_to_server_now(get_state_fn, dispatch_fn) {
    if (debounce_timer) {
        clearTimeout(debounce_timer);
        debounce_timer = null;
    }
    const state = typeof get_state_fn === 'function' ? get_state_fn() : null;
    if (state) {
        await run_sync(state, dispatch_fn);
    }
}

/**
 * Kör omedelbar sync till server (t.ex. vid navigering bort från granskning eller efter sparning av kört fast-text).
 * Rensar väntande debounce och sparar aktuell state direkt.
 */
export async function flush_sync_to_server(get_state_fn, dispatch_fn) {
    if (debounce_timer) {
        clearTimeout(debounce_timer);
        debounce_timer = null;
    }
    const state = typeof get_state_fn === 'function' ? get_state_fn() : null;
    if (state) {
        await run_sync(state, dispatch_fn);
    }
}
