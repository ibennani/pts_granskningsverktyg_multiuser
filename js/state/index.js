// js/state/index.js
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

function root_reducer(current_state, action) {
    if (AUDIT_ACTIONS.has(action.type)) return auditReducer(current_state, action);
    if (RULEFILE_ACTIONS.has(action.type)) return rulefileReducer(current_state, action);
    if (UI_ACTIONS.has(action.type)) return uiReducer(current_state, action);
    if (USER_ACTIONS.has(action.type)) return userReducer(current_state, action);
    return current_state;
}

let internal_state = { ...initial_state };
let listeners = [];
const dispatch_queue = [];
let is_dispatching = false;

function dispatch(action) {
    if (!action || typeof action.type !== 'string') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Invalid action dispatched. Action must be an object with a "type" property.', action);
        return Promise.reject(new Error('Invalid action'));
    }
    if (is_dispatching) {
        return new Promise((resolve, reject) => {
            dispatch_queue.push({ action, resolve, reject });
        });
    }
    return process_dispatch(action);
}

async function process_dispatch(action) {
    is_dispatching = true;
    try {
        await execute_single_dispatch(action, dispatch);
        while (dispatch_queue.length > 0) {
            const { action: queuedAction, resolve, reject } = dispatch_queue.shift();
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

function execute_single_dispatch(action, dispatch_fn) {
    return new Promise((resolve, reject) => {
        let state_before_dispatch = null;
        let state_after_reducer = null;
        try {
            state_before_dispatch = JSON.parse(JSON.stringify(internal_state));
            const previous_state_for_comparison = internal_state;
            state_after_reducer = root_reducer(internal_state, action);
            if (state_after_reducer !== previous_state_for_comparison) {
                if (!state_after_reducer || typeof state_after_reducer !== 'object') {
                    throw new Error(`Reducer returned invalid state for action type: ${action.type}`);
                }
                if (!state_after_reducer.hasOwnProperty('saveFileVersion') || !state_after_reducer.hasOwnProperty('auditStatus')) {
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
                        action.type === ActionTypes.UPDATE_METADATA && action.payload?.skip_server_sync === true;
                    const skip_sync_same_user_tab_broadcast = action.payload?.same_user_tab_broadcast === true;
                    if (!skip_sync_after_internal_metadata &&
                        !skip_sync_same_user_tab_broadcast &&
                        action.type !== ActionTypes.CLEAR_STAGED_SAMPLE_CHANGES &&
                        action.type !== ActionTypes.REPLACE_STATE_FROM_REMOTE &&
                        action.type !== ActionTypes.REPLACE_RULEFILE_FROM_REMOTE &&
                        action.type !== ActionTypes.SET_REMOTE_AUDIT_ID &&
                        internal_state.auditStatus !== 'not_started') {
                        schedule_sync_to_server(internal_state, dispatch_fn);
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
                        skip_render: action?.payload?.skip_render === true && !action?.payload?.same_user_tab_broadcast,
                        force_same_user_tab_render: action?.payload?.same_user_tab_broadcast === true,
                        action_type: action.type,
                        requirement_result_update:
                            action.type === ActionTypes.UPDATE_REQUIREMENT_RESULT
                                ? {
                                    sampleId: action.payload.sampleId,
                                    requirementId: action.payload.requirementId
                                }
                                : null,
                        _debug_action_type: window.__GV_DEBUG_MODAL_SCROLL ? action?.type : undefined
                    });
                } catch (listenerError) {
                    if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Error notifying state listeners:', listenerError);
                }
            }
            resolve();
        } catch (error) {
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
            reject(new Error(`State dispatch failed for action type '${action.type}': ${error.message}`));
        }
    });
}

function getState() {
    try {
        return JSON.parse(JSON.stringify(internal_state));
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Failed to serialize state in getState:', error);
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION, auditStatus: 'error' };
    }
}

function subscribe(listener_function) {
    if (typeof listener_function !== 'function') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Listener must be a function.');
        return () => {};
    }
    listeners.push(listener_function);
    return () => { listeners = listeners.filter(l => l !== listener_function); };
}

function notify_listeners(listener_meta = null) {
    const currentSnapshot = getState();
    if (window.__GV_DEBUG_MODAL_SCROLL) {
        consoleManager.log('[GV-ModalDebug] notify_listeners', {
            skip_render: listener_meta?.skip_render,
            action_type: listener_meta?._debug_action_type,
            listenerCount: listeners.length
        });
    }
    setTimeout(() => {
        listeners.forEach(listener => {
            try {
                listener(currentSnapshot, listener_meta);
            } catch (error) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Error in listener function:', error);
            }
        });
    }, 0);
}

function has_restorable_state(state) {
    if (!state || typeof state !== 'object') return false;
    if (state.ruleFileContent) return true;
    if (state.samples && state.samples.length > 0) return true;
    if (state.auditStatus && state.auditStatus !== 'not_started') return true;
    const meta = state.auditMetadata;
    if (meta && typeof meta === 'object') {
        const has_content = ['caseNumber', 'actorName', 'actorLink', 'auditorName', 'caseHandler', 'internalComment']
            .some(key => meta[key] && String(meta[key]).trim() !== '');
        if (has_content) return true;
    }
    return false;
}

function loadStateFromLocalStorageBackup() {
    try {
        const serialized = localStorage.getItem(APP_STATE_BACKUP_KEY);
        if (serialized === null) return null;
        const stored = JSON.parse(serialized);
        if (!stored) return null;
        let state_to_merge;
        let restore_position = null;
        if (stored.state && stored.restorePosition !== undefined) {
            state_to_merge = stored.state;
            restore_position = stored.restorePosition;
        } else if (stored.saveFileVersion) {
            state_to_merge = stored;
        } else {
            return null;
        }
        if (!state_to_merge.saveFileVersion || !state_to_merge.saveFileVersion.startsWith(APP_STATE_VERSION.split('.')[0])) {
            localStorage.removeItem(APP_STATE_BACKUP_KEY);
            return null;
        }
        const merged = {
            ...JSON.parse(JSON.stringify(initial_state)),
            ...state_to_merge,
            saveFileVersion: APP_STATE_VERSION
        };
        if (!has_restorable_state(merged)) return null;
        return { state: merged, restorePosition: restore_position };
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

function updateBackupRestorePosition(restore_position) {
    try {
        const serialized = localStorage.getItem(APP_STATE_BACKUP_KEY);
        if (serialized === null) return;
        const backup = JSON.parse(serialized);
        if (!backup || !backup.state) return;
        backup.restorePosition = restore_position;
        localStorage.setItem(APP_STATE_BACKUP_KEY, JSON.stringify(backup));
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Could not update backup restore position:', e);
    }
}

function loadStateFromSessionStorage() {
    const serializedState = sessionStorage.getItem(APP_STATE_KEY);
    if (serializedState === null) {
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
    }
    try {
        const storedState = JSON.parse(serializedState);
        if (storedState.saveFileVersion && storedState.saveFileVersion.startsWith(APP_STATE_VERSION.split('.')[0])) {
            return {
                ...JSON.parse(JSON.stringify(initial_state)),
                ...storedState,
                saveFileVersion: APP_STATE_VERSION
            };
        }
        sessionStorage.removeItem(APP_STATE_KEY);
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
    } catch {
        sessionStorage.removeItem(APP_STATE_KEY);
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
    }
}

function saveStateToSessionStorage(state_to_save) {
    try {
        const complete_state_to_save = { ...state_to_save, saveFileVersion: APP_STATE_VERSION };
        const serializedState = JSON.stringify(complete_state_to_save);
        sessionStorage.setItem(APP_STATE_KEY, serializedState);
        if (has_restorable_state(complete_state_to_save)) {
            try {
                const restore_position = typeof window.__gv_get_restore_position === 'function' ? window.__gv_get_restore_position() : null;
                const backup = { state: complete_state_to_save, restorePosition: restore_position };
                localStorage.setItem(APP_STATE_BACKUP_KEY, JSON.stringify(backup));
            } catch (localE) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Could not save state backup to localStorage:', localE);
            }
        }
    } catch (e) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] Could not save state to sessionStorage:', e);
        if (app_runtime_refs.notification_component && typeof app_runtime_refs.notification_component.show_global_message === 'function') {
            app_runtime_refs.notification_component.show_global_message(get_translation_t()('critical_error_saving_session_data_lost'), 'error');
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
