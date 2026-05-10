/**
 * @fileoverview Centralt state-lager: dispatch, persistens i sessionStorage,
 * backup i localStorage och notifiering av lyssnare. Se docs/state_and_persistence.md.
 *
 * Tillståndsflöde (kort): komponenter anropar dispatch({ type, payload }) → root_reducer
 * delegerar till auditReducer / rulefileReducer / uiReducer / userReducer → nytt state sparas
 * i sessionStorage (saveStateToSessionStorage) och lyssnare notifieras; server synkas via
 * schedule_sync_to_server(getState, …) när det är lämpligt; synk läser alltid färsk state vid körning.
 * Autospar för övriga formulär sker separat (autosave_service).
 */
import * as AuditLogic from '../audit_logic.js';
import { schedule_sync_to_server, schedule_sync_rulefile_to_server } from '../logic/server_sync.js';
import { ActionTypes } from './actionTypes.js';
import { initial_state, APP_STATE_VERSION } from './initialState.js';
import { auditReducer } from './auditReducer.js';
import { rulefileReducer } from './rulefileReducer.js';
import { uiReducer } from './uiReducer.js';
import { userReducer } from './userReducer.js';
import { consoleManager } from '../utils/console_manager.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import { get_translation_t } from '../utils/translation_access.js';
import { is_debug_autosave_focus, is_debug_modal_scroll } from '../app/runtime_flags.js';
import { get_restore_position_via_hook } from '../app/browser_globals.js';
import { sanitize_persisted_app_state_shape } from '../logic/sanitize_persisted_app_state.js';

const APP_STATE_KEY = 'digitalTillsynAppCentralState';
const APP_STATE_BACKUP_KEY = 'digitalTillsynAppStateBackup';

const AUDIT_ACTIONS = new Set([
    ActionTypes.DELETE_CHECK_FROM_REQUIREMENT,
    ActionTypes.DELETE_CRITERION_FROM_CHECK,
    ActionTypes.UPDATE_REQUIREMENT_DEFINITION,
    ActionTypes.ADD_REQUIREMENT_DEFINITION,
    ActionTypes.DELETE_REQUIREMENT_DEFINITION,
    ActionTypes.CONFIRM_SINGLE_REVIEWED_REQUIREMENT,
    ActionTypes.CONFIRM_ALL_REVIEWED_REQUIREMENTS,
    ActionTypes.MARK_ALL_UNREVIEWED_AS_PASSED,
    ActionTypes.MARK_REQUIREMENT_AS_PASSED_IN_ALL_SAMPLES,
    ActionTypes.STAGE_SAMPLE_CHANGES,
    ActionTypes.CLEAR_STAGED_SAMPLE_CHANGES,
    ActionTypes.SET_SAMPLE_EDIT_DRAFT,
    ActionTypes.CLEAR_SAMPLE_EDIT_DRAFT,
    ActionTypes.INITIALIZE_NEW_AUDIT,
    ActionTypes.INITIALIZE_RULEFILE_EDITING,
    ActionTypes.LOAD_AUDIT_FROM_FILE,
    ActionTypes.UPDATE_METADATA,
    ActionTypes.ADD_SAMPLE,
    ActionTypes.UPDATE_SAMPLE,
    ActionTypes.DELETE_SAMPLE,
    ActionTypes.UPDATE_REQUIREMENT_RESULT,
    ActionTypes.SET_AUDIT_STATUS,
    ActionTypes.SET_REMOTE_AUDIT_ID,
    ActionTypes.REPLACE_STATE_FROM_REMOTE
]);

const RULEFILE_ACTIONS = new Set([
    ActionTypes.REPLACE_RULEFILE_AND_RECONCILE,
    ActionTypes.SET_RULE_FILE_CONTENT,
    ActionTypes.UPDATE_RULEFILE_CONTENT,
    ActionTypes.SET_RULEFILE_EDIT_BASELINE,
    ActionTypes.REPLACE_RULEFILE_FROM_REMOTE
]);

const UI_ACTIONS = new Set([
    ActionTypes.SET_UI_FILTER_SETTINGS,
    ActionTypes.SET_ALL_REQUIREMENTS_FILTER_SETTINGS,
    ActionTypes.SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS
]);

const USER_ACTIONS = new Set([ActionTypes.SET_MANAGE_USERS_TEXT]);

/** Internt state-objekt tills strikt AppState-typ finns. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reducer-lager returnerar ännu any
type InternalState = any;

function root_reducer(current_state: InternalState, action: { type: string; payload?: unknown }): InternalState {
    if (AUDIT_ACTIONS.has(action.type)) return auditReducer(current_state, action);
    if (RULEFILE_ACTIONS.has(action.type)) return rulefileReducer(current_state, action);
    if (UI_ACTIONS.has(action.type)) return uiReducer(current_state, action);
    if (USER_ACTIONS.has(action.type)) return userReducer(current_state, action);
    return current_state;
}

let internal_state: InternalState = { ...initial_state };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- lyssnare från hela appen
let listeners: Array<(snapshot: any, meta?: unknown) => void> = [];
type Queued = { action: { type: string; payload?: unknown }; resolve: () => void; reject: (e: unknown) => void };
const dispatch_queue: Queued[] = [];
let is_dispatching = false;

function dispatch(action: { type: string; payload?: unknown } | null | undefined) {
    if (!action || typeof action.type !== 'string') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Invalid action dispatched. Action must be an object with a "type" property.', action);
        return Promise.reject(new Error('Invalid action'));
    }
    if (is_dispatching) {
        return new Promise<void>((resolve, reject) => {
            dispatch_queue.push({ action, resolve, reject });
        });
    }
    return process_dispatch(action);
}

async function process_dispatch(action: { type: string; payload?: unknown }) {
    is_dispatching = true;
    try {
        await execute_single_dispatch(action, dispatch);
        while (dispatch_queue.length > 0) {
            const next = dispatch_queue.shift();
            if (!next) break;
            const { action: queuedAction, resolve, reject } = next;
            try {
                await execute_single_dispatch(queuedAction, dispatch);
                resolve();
            } catch (error) {
                reject(error);
            }
        }
    } finally {
        is_dispatching = false;
    }
}

function execute_single_dispatch(
    action: { type: string; payload?: unknown },
    dispatch_fn: typeof dispatch
) {
    return new Promise<void>((resolve, reject) => {
        let state_before_dispatch: InternalState | null = null;
        let state_after_reducer: InternalState | null = null;
        try {
            state_before_dispatch = JSON.parse(JSON.stringify(internal_state));
            const previous_state_for_comparison = internal_state;
            const action_payload = action.payload as Record<string, unknown> | undefined;
            state_after_reducer = root_reducer(internal_state, action);
            if (state_after_reducer !== previous_state_for_comparison) {
                if (!state_after_reducer || typeof state_after_reducer !== 'object') {
                    throw new Error(`Reducer returned invalid state for action type: ${action.type}`);
                }
                if (!Object.prototype.hasOwnProperty.call(state_after_reducer, 'saveFileVersion') ||
                    !Object.prototype.hasOwnProperty.call(state_after_reducer, 'auditStatus')) {
                    throw new Error(`Reducer returned state missing critical properties for action type: ${action.type}`);
                }
                internal_state = state_after_reducer;
                try {
                    saveStateToSessionStorage(internal_state);
                } catch (saveError) {
                    if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Failed to save state to sessionStorage:', saveError);
                }
                try {
                    const skip_sync_after_internal_metadata =
                        action.type === ActionTypes.UPDATE_METADATA && action_payload?.skip_server_sync === true;
                    const skip_sync_same_user_tab_broadcast = action_payload?.same_user_tab_broadcast === true;
                    if (!skip_sync_after_internal_metadata &&
                        !skip_sync_same_user_tab_broadcast &&
                        action.type !== ActionTypes.STAGE_SAMPLE_CHANGES &&
                        action.type !== ActionTypes.CLEAR_STAGED_SAMPLE_CHANGES &&
                        action.type !== ActionTypes.SET_SAMPLE_EDIT_DRAFT &&
                        action.type !== ActionTypes.CLEAR_SAMPLE_EDIT_DRAFT &&
                        action.type !== ActionTypes.REPLACE_STATE_FROM_REMOTE &&
                        action.type !== ActionTypes.REPLACE_RULEFILE_FROM_REMOTE &&
                        action.type !== ActionTypes.SET_REMOTE_AUDIT_ID &&
                        internal_state.auditStatus !== 'not_started') {
                        schedule_sync_to_server(() => getState(), dispatch_fn);
                    }
                } catch {
                    // ignoreras medvetet
                }
                try {
                    if (action.type === ActionTypes.UPDATE_RULEFILE_CONTENT &&
                        internal_state.auditStatus === 'rulefile_editing' &&
                        internal_state.ruleSetId) {
                        schedule_sync_rulefile_to_server(getState, dispatch);
                    }
                } catch {
                    // ignoreras medvetet
                }
                try {
                    notify_listeners({
                        /** Hoppar över tunga chrome-uppdateringar (top/bottom bar, sidtitel, vänstermeny). */
                        skip_render:
                            action_payload?.skip_render === true ||
                            action_payload?.same_user_tab_broadcast === true,
                        /** Samma flik / BroadcastChannel: kör endast aktuell vykomponents render (ingen chrome). */
                        force_same_user_tab_render: action_payload?.same_user_tab_broadcast === true,
                        action_type: action.type,
                        requirement_result_update:
                            action.type === ActionTypes.UPDATE_REQUIREMENT_RESULT && action_payload
                                ? {
                                    sampleId: action_payload.sampleId,
                                    requirementId: action_payload.requirementId
                                }
                                : null,
                        _debug_action_type: is_debug_modal_scroll() ? action?.type : undefined
                    });
                } catch (listenerError) {
                    if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Error notifying state listeners:', listenerError);
                }
            }
            resolve();
        } catch (error: unknown) {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Critical error in dispatch or reducer:', error, 'Action:', action);
            if (state_before_dispatch && state_before_dispatch !== internal_state) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Attempting to restore state from backup due to reducer error');
                try {
                    internal_state = state_before_dispatch;
                    saveStateToSessionStorage(internal_state);
                    notify_listeners();
                    consoleManager.info('[State] State successfully restored from backup');
                } catch (restoreError) {
                    if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Failed to restore state from backup:', restoreError);
                }
            }
            const msg = error instanceof Error ? error.message : String(error);
            reject(new Error(`State dispatch failed for action type '${action.type}': ${msg}`));
        }
    });
}

function getState(): InternalState {
    try {
        return JSON.parse(JSON.stringify(internal_state));
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Failed to serialize state in getState:', error);
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION, auditStatus: 'error' };
    }
}

function subscribe(listener_function: (snapshot: unknown, meta?: unknown) => void) {
    if (typeof listener_function !== 'function') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Listener must be a function.');
        return () => {};
    }
    listeners.push(listener_function);
    return () => { listeners = listeners.filter((l) => l !== listener_function); };
}

function notify_listeners(listener_meta: Record<string, unknown> | null = null) {
    const currentSnapshot = getState();
    if (typeof window !== 'undefined' && is_debug_autosave_focus()) {
        consoleManager.log('[GV-Debug autospar-fokus] notify_listeners', {
            action_type: listener_meta?.action_type,
            skip_render: listener_meta?.skip_render,
            requirement_result_update: listener_meta?.requirement_result_update ?? null,
            force_same_user_tab_render: listener_meta?.force_same_user_tab_render ?? null
        });
    }
    if (is_debug_modal_scroll()) {
        consoleManager.log('[GV-ModalDebug] notify_listeners', {
            skip_render: listener_meta?.skip_render,
            action_type: listener_meta?._debug_action_type,
            listenerCount: listeners.length
        });
    }
    setTimeout(() => {
        listeners.forEach((listener) => {
            try {
                listener(currentSnapshot, listener_meta);
            } catch (err) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Error in listener function:', err);
            }
        });
    }, 0);
}

function has_restorable_state(state: InternalState | null | undefined): boolean {
    if (!state || typeof state !== 'object') return false;
    if (state.ruleFileContent) return true;
    if (state.samples && state.samples.length > 0) return true;
    if (state.auditStatus && state.auditStatus !== 'not_started') return true;
    const meta = state.auditMetadata as Record<string, unknown> | undefined;
    if (meta && typeof meta === 'object') {
        const has_content = ['caseNumber', 'actorName', 'actorLink', 'auditorName', 'caseHandler', 'internalComment']
            .some((key) => meta[key] && String(meta[key]).trim() !== '');
        if (has_content) return true;
    }
    return false;
}

function loadStateFromLocalStorageBackup(): { state: InternalState; restorePosition: unknown } | null {
    try {
        const serialized = localStorage.getItem(APP_STATE_BACKUP_KEY);
        if (serialized === null) return null;
        const stored = JSON.parse(serialized) as Record<string, unknown> | null;
        if (!stored) return null;
        let state_to_merge: unknown;
        let restore_position: unknown = null;
        if (stored.state && stored.restorePosition !== undefined) {
            state_to_merge = stored.state;
            restore_position = stored.restorePosition;
        } else if (stored.saveFileVersion) {
            state_to_merge = stored;
        } else {
            return null;
        }
        if (typeof state_to_merge !== 'object' || state_to_merge === null || Array.isArray(state_to_merge)) {
            try {
                localStorage.removeItem(APP_STATE_BACKUP_KEY);
            } catch (_) {
                // ignoreras medvetet
            }
            return null;
        }
        const stm = state_to_merge as Record<string, unknown>;
        if (!stm.saveFileVersion || !String(stm.saveFileVersion).startsWith(APP_STATE_VERSION.split('.')[0])) {
            localStorage.removeItem(APP_STATE_BACKUP_KEY);
            return null;
        }
        const merged = {
            ...JSON.parse(JSON.stringify(initial_state)),
            ...stm,
            saveFileVersion: APP_STATE_VERSION
        };
        const safe_merged = sanitize_persisted_app_state_shape(merged) as InternalState;
        if (!has_restorable_state(safe_merged)) return null;
        return { state: safe_merged, restorePosition: restore_position };
    } catch {
        try {
            localStorage.removeItem(APP_STATE_BACKUP_KEY);
        } catch (_) {
            // ignoreras medvetet
        }
        return null;
    }
}

function clearLocalStorageBackup() {
    try {
        localStorage.removeItem(APP_STATE_BACKUP_KEY);
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Could not clear localStorage backup:', e);
    }
}

function updateBackupRestorePosition(restore_position: unknown) {
    try {
        const serialized = localStorage.getItem(APP_STATE_BACKUP_KEY);
        if (serialized === null) return;
        const backup = JSON.parse(serialized) as Record<string, unknown>;
        if (!backup || !backup.state) return;
        backup.restorePosition = restore_position;
        localStorage.setItem(APP_STATE_BACKUP_KEY, JSON.stringify(backup));
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Could not update backup restore position:', e);
    }
}

function loadStateFromSessionStorage(): InternalState {
    const serializedState = sessionStorage.getItem(APP_STATE_KEY);
    if (serializedState === null) {
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
    }
    try {
        const storedState = JSON.parse(serializedState) as unknown;
        if (!storedState || typeof storedState !== 'object' || Array.isArray(storedState)) {
            sessionStorage.removeItem(APP_STATE_KEY);
            return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
        }
        const ss = storedState as Record<string, unknown>;
        if (ss.saveFileVersion && String(ss.saveFileVersion).startsWith(APP_STATE_VERSION.split('.')[0])) {
            const merged = {
                ...JSON.parse(JSON.stringify(initial_state)),
                ...ss,
                saveFileVersion: APP_STATE_VERSION
            };
            return sanitize_persisted_app_state_shape(merged) as InternalState;
        }
        sessionStorage.removeItem(APP_STATE_KEY);
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
    } catch {
        sessionStorage.removeItem(APP_STATE_KEY);
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
    }
}

function saveStateToSessionStorage(state_to_save: InternalState) {
    try {
        const complete_state_to_save = { ...state_to_save, saveFileVersion: APP_STATE_VERSION };
        const serializedState = JSON.stringify(complete_state_to_save);
        sessionStorage.setItem(APP_STATE_KEY, serializedState);
        if (has_restorable_state(complete_state_to_save)) {
            try {
                const restore_position = get_restore_position_via_hook();
                const backup = { state: complete_state_to_save, restorePosition: restore_position };
                localStorage.setItem(APP_STATE_BACKUP_KEY, JSON.stringify(backup));
            } catch (localE) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Could not save state backup to localStorage:', localE);
            }
        }
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Could not save state to sessionStorage:', e);
        const notif = app_runtime_refs.notification_component as
            | { show_global_message: (message: string, level: string) => void }
            | null
            | undefined;
        if (notif && typeof notif.show_global_message === 'function') {
            const t = get_translation_t() as (key: string, opts?: Record<string, unknown>) => string;
            notif.show_global_message(t('critical_error_saving_session_data_lost', {}), 'error');
        }
    }
}

function initState() {
    internal_state = loadStateFromSessionStorage();
    if (AuditLogic && typeof AuditLogic.updateIncrementalDeficiencyIds === 'function') {
        internal_state = AuditLogic.updateIncrementalDeficiencyIds(internal_state);
        saveStateToSessionStorage(internal_state);
    } else {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] AuditLogic not available during initState. State may be inconsistent.');
    }
}

export {
    dispatch,
    getState,
    subscribe,
    initState,
    ActionTypes as StoreActionTypes,
    initial_state as StoreInitialState,
    loadStateFromLocalStorageBackup,
    clearLocalStorageBackup,
    updateBackupRestorePosition,
    APP_STATE_KEY
};
