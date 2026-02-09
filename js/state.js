// js/state.js
import * as AuditLogic from './audit_logic.js';

const APP_STATE_KEY = 'digitalTillsynAppCentralState';
const APP_STATE_VERSION = '2.1.0'; // Version bumped to reflect new scoring model

export const ActionTypes = {
    INITIALIZE_NEW_AUDIT: 'INITIALIZE_NEW_AUDIT',
    INITIALIZE_RULEFILE_EDITING: 'INITIALIZE_RULEFILE_EDITING',
    LOAD_AUDIT_FROM_FILE: 'LOAD_AUDIT_FROM_FILE',
    UPDATE_METADATA: 'UPDATE_METADATA',
    ADD_SAMPLE: 'ADD_SAMPLE',
    UPDATE_SAMPLE: 'UPDATE_SAMPLE',
    DELETE_SAMPLE: 'DELETE_SAMPLE',
    SET_AUDIT_STATUS: 'SET_AUDIT_STATUS',
    UPDATE_REQUIREMENT_RESULT: 'UPDATE_REQUIREMENT_RESULT',
    SET_RULE_FILE_CONTENT: 'SET_RULE_FILE_CONTENT',
    UPDATE_RULEFILE_CONTENT: 'UPDATE_RULEFILE_CONTENT',
    REPLACE_RULEFILE_AND_RECONCILE: 'REPLACE_RULEFILE_AND_RECONCILE',
    SET_UI_FILTER_SETTINGS: 'SET_UI_FILTER_SETTINGS',
    SET_ALL_REQUIREMENTS_FILTER_SETTINGS: 'SET_ALL_REQUIREMENTS_FILTER_SETTINGS',
    SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS: 'SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS',
    STAGE_SAMPLE_CHANGES: 'STAGE_SAMPLE_CHANGES',
    CLEAR_STAGED_SAMPLE_CHANGES: 'CLEAR_STAGED_SAMPLE_CHANGES',
    CONFIRM_SINGLE_REVIEWED_REQUIREMENT: 'CONFIRM_SINGLE_REVIEWED_REQUIREMENT',
    CONFIRM_ALL_REVIEWED_REQUIREMENTS: 'CONFIRM_ALL_REVIEWED_REQUIREMENTS',
    UPDATE_REQUIREMENT_DEFINITION: 'UPDATE_REQUIREMENT_DEFINITION',
    ADD_REQUIREMENT_DEFINITION: 'ADD_REQUIREMENT_DEFINITION',
    DELETE_REQUIREMENT_DEFINITION: 'DELETE_REQUIREMENT_DEFINITION',
    DELETE_CHECK_FROM_REQUIREMENT: 'DELETE_CHECK_FROM_REQUIREMENT',
    DELETE_CRITERION_FROM_CHECK: 'DELETE_CRITERION_FROM_CHECK',
    SET_RULEFILE_EDIT_BASELINE: 'SET_RULEFILE_EDIT_BASELINE'
};

const initial_state = {
    saveFileVersion: APP_STATE_VERSION,
    ruleFileContent: null,
    auditMetadata: {
        caseNumber: '',
        actorName: '',
        actorLink: '',
        auditorName: '',
        caseHandler: '',
        internalComment: ''
    },
    auditStatus: 'not_started',
    startTime: null,
    endTime: null,
    samples: [],
    deficiencyCounter: 1,
    ruleFileOriginalContentString: null,
    ruleFileOriginalFilename: '',
    uiSettings: {
        requirementListFilter: {
            searchText: '',
            sortBy: 'default',
            status: { 
                passed: true, 
                failed: true, 
                partially_audited: true, 
                not_audited: true, 
                updated: true
            }
        },
        allRequirementsFilter: {
            searchText: '',
            sortBy: 'default'
        },
        requirementAuditSidebar: {
            selectedMode: 'sample_requirements',
            filtersByMode: {
                sample_requirements: {
                    searchText: '',
                    sortBy: 'ref_asc',
                    status: { passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
                },
                requirement_samples: {
                    searchText: '',
                    sortBy: 'creation_order',
                    status: { passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
                }
            }
        }
    },
    auditCalculations: {}, 
    pendingSampleChanges: null
};

let internal_state = { ...initial_state };
let listeners = [];

// Dispatch queue för att förhindra race conditions
let dispatch_queue = [];
let is_dispatching = false;

function get_current_iso_datetime_utc_internal() {
    return new Date().toISOString();
}

function root_reducer(current_state, action) {
    let new_state;

    switch (action.type) {
        case ActionTypes.DELETE_CHECK_FROM_REQUIREMENT:
            const { requirementId: reqIdForCheck, checkId } = action.payload;
            
            // Säkerställ att ruleFileContent finns och har requirements
            if (!current_state.ruleFileContent || !current_state.ruleFileContent.requirements) {
                console.warn('[State.js] Cannot delete check: ruleFileContent or requirements is null/undefined');
                return current_state;
            }
            
            const reqToUpdateCheck = current_state.ruleFileContent.requirements[reqIdForCheck];
            if (reqToUpdateCheck) {
                const updatedChecks = reqToUpdateCheck.checks.filter(c => c.id !== checkId);
                const updatedReq = { ...reqToUpdateCheck, checks: updatedChecks };
                const newRequirements = { ...current_state.ruleFileContent.requirements, [reqIdForCheck]: updatedReq };
                return { ...current_state, ruleFileContent: { ...current_state.ruleFileContent, requirements: newRequirements } };
            }
            return current_state;

        case ActionTypes.DELETE_CRITERION_FROM_CHECK:
            const { requirementId: reqIdForPc, checkId: checkIdForPc, passCriterionId } = action.payload;
            
            // Säkerställ att ruleFileContent finns och har requirements
            if (!current_state.ruleFileContent || !current_state.ruleFileContent.requirements) {
                console.warn('[State.js] Cannot delete criterion: ruleFileContent or requirements is null/undefined');
                return current_state;
            }
            
            const reqToUpdatePc = current_state.ruleFileContent.requirements[reqIdForPc];
            if (reqToUpdatePc) {
                const updatedChecksForPc = reqToUpdatePc.checks.map(c => {
                    if (c.id === checkIdForPc) {
                        const updatedPassCriteria = c.passCriteria.filter(pc => pc.id !== passCriterionId);
                        return { ...c, passCriteria: updatedPassCriteria };
                    }
                    return c;
                });
                const updatedReqForPc = { ...reqToUpdatePc, checks: updatedChecksForPc };
                const newRequirementsForPc = { ...current_state.ruleFileContent.requirements, [reqIdForPc]: updatedReqForPc };
                return { ...current_state, ruleFileContent: { ...current_state.ruleFileContent, requirements: newRequirementsForPc } };
            }
            return current_state;

        case ActionTypes.UPDATE_REQUIREMENT_DEFINITION:
            const { requirementId: updateReqId, updatedRequirementData } = action.payload;
            // --- DEBUG START ---
            console.log(`%c[DEBUG] Reducer: Received UPDATE_REQUIREMENT_DEFINITION for ID '${updateReqId}'.`, 'color: #FF69B4;');
            console.log(`%c[DEBUG] Reducer: INCOMING classifications data:`, 'color: #FF69B4;', JSON.parse(JSON.stringify(updatedRequirementData.classifications)));
            // --- DEBUG END ---
            if (current_state.ruleFileContent?.requirements?.[updateReqId]) {
                const newRequirements = {
                    ...current_state.ruleFileContent.requirements,
                    [updateReqId]: updatedRequirementData
                };
                const final_state = {
                    ...current_state,
                    ruleFileContent: {
                        ...current_state.ruleFileContent,
                        requirements: newRequirements
                    }
                };
                // --- DEBUG START ---
                console.log(`%c[DEBUG] Reducer: FINAL classifications in new state for '${updateReqId}':`, 'color: #FF69B4; font-weight: bold;', JSON.parse(JSON.stringify(final_state.ruleFileContent.requirements[updateReqId].classifications)));
                // --- DEBUG END ---
                return final_state;
            }
            return current_state;

        case ActionTypes.ADD_REQUIREMENT_DEFINITION:
            const { requirementId: addReqId, newRequirementData } = action.payload;
            console.log(`%c[DEBUG] Reducer: Received ADD_REQUIREMENT_DEFINITION for ID '${addReqId}'.`, 'color: #00FF00;');
            if (current_state.ruleFileContent?.requirements && newRequirementData) {
                const newRequirements = {
                    ...current_state.ruleFileContent.requirements,
                    [addReqId]: newRequirementData
                };
                return {
                    ...current_state,
                    ruleFileContent: {
                        ...current_state.ruleFileContent,
                        requirements: newRequirements
                    }
                };
            }
            return current_state;

        case ActionTypes.DELETE_REQUIREMENT_DEFINITION:
            const { requirementId: deleteReqId } = action.payload;
            
            // Säkerställ att ruleFileContent finns och har requirements
            if (!current_state.ruleFileContent || !current_state.ruleFileContent.requirements) {
                console.warn('[State.js] Cannot delete requirement: ruleFileContent or requirements is null/undefined');
                return current_state;
            }
            
            const newRequirementsAfterDelete = { ...current_state.ruleFileContent.requirements };
            delete newRequirementsAfterDelete[deleteReqId];
            
            const updatedSamples = current_state.samples.map(sample => {
                if (sample.requirementResults && sample.requirementResults[deleteReqId]) {
                    const newResults = { ...sample.requirementResults };
                    delete newResults[deleteReqId];
                    return { ...sample, requirementResults: newResults };
                }
                return sample;
            });

            return {
                ...current_state,
                samples: updatedSamples,
                ruleFileContent: {
                    ...current_state.ruleFileContent,
                    requirements: newRequirementsAfterDelete
                }
            };

        case ActionTypes.CONFIRM_SINGLE_REVIEWED_REQUIREMENT:
            const { sampleId, requirementId } = action.payload;
            return {
                ...current_state,
                samples: current_state.samples.map(sample => {
                    if (sample.id === sampleId && sample.requirementResults?.[requirementId]?.needsReview) {
                        const newResults = { ...sample.requirementResults };
                        const newReqResult = { ...newResults[requirementId] };
                        delete newReqResult.needsReview;
                        newResults[requirementId] = newReqResult;
                        return { ...sample, requirementResults: newResults };
                    }
                    return sample;
                })
            };

        case ActionTypes.CONFIRM_ALL_REVIEWED_REQUIREMENTS:
            return {
                ...current_state,
                samples: current_state.samples.map(sample => {
                    const newResults = {};
                    let hasChanged = false;
                    Object.keys(sample.requirementResults || {}).forEach(reqId => {
                        const originalResult = sample.requirementResults[reqId];
                        if (originalResult?.needsReview) {
                            hasChanged = true;
                            newResults[reqId] = { ...originalResult };
                            delete newResults[reqId].needsReview;
                        } else {
                            newResults[reqId] = originalResult;
                        }
                    });
                    return hasChanged ? { ...sample, requirementResults: newResults } : sample;
                })
            };

        case ActionTypes.STAGE_SAMPLE_CHANGES:
            return {
                ...current_state,
                pendingSampleChanges: action.payload
            };

        case ActionTypes.CLEAR_STAGED_SAMPLE_CHANGES:
            return {
                ...current_state,
                pendingSampleChanges: null
            };
        
        case ActionTypes.INITIALIZE_NEW_AUDIT:
            return {
                ...initial_state,
                saveFileVersion: APP_STATE_VERSION,
                ruleFileContent: action.payload.ruleFileContent,
                uiSettings: JSON.parse(JSON.stringify(initial_state.uiSettings)),
                auditStatus: 'not_started'
            };

        case ActionTypes.INITIALIZE_RULEFILE_EDITING:
            return {
                ...initial_state,
                saveFileVersion: APP_STATE_VERSION,
                ruleFileContent: action.payload.ruleFileContent,
                uiSettings: JSON.parse(JSON.stringify(initial_state.uiSettings)),
                auditStatus: 'rulefile_editing',
                ruleFileOriginalContentString: action.payload.originalRuleFileContentString || null,
                ruleFileOriginalFilename: action.payload.originalRuleFileFilename || ''
            };

        case ActionTypes.LOAD_AUDIT_FROM_FILE:
            if (action.payload && typeof action.payload === 'object') {
                const loaded_data = action.payload;
                const new_state_base = JSON.parse(JSON.stringify(initial_state));
                let merged_state = {
                    ...new_state_base,
                    ...loaded_data,
                    uiSettings: {
                        ...new_state_base.uiSettings,
                        ...(loaded_data.uiSettings || {})
                    },
                    saveFileVersion: APP_STATE_VERSION
                };
                (merged_state.samples || []).forEach(sample => {
                    Object.values(sample.requirementResults || {}).forEach(reqResult => {
                        Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                            if (checkResult.passCriteria) {
                                Object.keys(checkResult.passCriteria).forEach(pcId => {
                                    const pcValue = checkResult.passCriteria[pcId];
                                    if (typeof pcValue === 'string') {
                                        checkResult.passCriteria[pcId] = {
                                            status: pcValue,
                                            observationDetail: '',
                                            timestamp: merged_state.startTime || null 
                                        };
                                    }
                                });
                            }
                        });
                    });
                });
                if (!merged_state.deficiencyCounter) {
                    merged_state.deficiencyCounter = 1;
                }
                
                // Beräkna om tider baserat på timestamps i resultaten
                merged_state = AuditLogic.recalculateAuditTimes(merged_state);

                // Beräkna om statusar med korrekt logik (t.ex. OR-logik) och uppdatera bristindex om granskningen är låst
                return AuditLogic.recalculateStatusesOnLoad(merged_state);
            }
            console.warn('[State.js] LOAD_AUDIT_FROM_FILE: Invalid payload.', action.payload);
            return current_state;

        case ActionTypes.UPDATE_METADATA:
            return {
                ...current_state,
                auditMetadata: { ...current_state.auditMetadata, ...action.payload }
            };

        case ActionTypes.ADD_SAMPLE:
            const new_sample_with_defaults = {
                sampleCategory: '',
                sampleType: '',
                ...action.payload
            };
            return { ...current_state, samples: [...current_state.samples, new_sample_with_defaults] };

        case ActionTypes.UPDATE_SAMPLE:
            return {
                ...current_state,
                samples: current_state.samples.map(s => s.id === action.payload.sampleId ? { ...s, ...action.payload.updatedSampleData } : s)
            };
        
        case ActionTypes.DELETE_SAMPLE:
            new_state = { ...current_state, samples: current_state.samples.filter(s => s.id !== action.payload.sampleId) };
            return AuditLogic.updateIncrementalDeficiencyIds(new_state);

        case ActionTypes.UPDATE_REQUIREMENT_RESULT:
            const { sampleId: updateSampleId, requirementId: updateRequirementId, newRequirementResult } = action.payload;
            const result_to_save = { ...newRequirementResult };
            delete result_to_save.needsReview;
            new_state = {
                ...current_state,
                samples: current_state.samples.map(sample => 
                    (sample.id === updateSampleId)
                        ? { ...sample, requirementResults: { ...(sample.requirementResults || {}), [updateRequirementId]: result_to_save }}
                        : sample
                )
            };
            new_state = AuditLogic.recalculateAuditTimes(new_state);
            return AuditLogic.updateIncrementalDeficiencyIds(new_state);

        case ActionTypes.SET_AUDIT_STATUS:
            const newStatus = action.payload.status;
            let timeUpdate = {};
            let state_before_status_change = current_state;

            if (newStatus === 'locked' && current_state.auditStatus === 'in_progress') {
                if (current_state.deficiencyCounter === 1) {
                    state_before_status_change = AuditLogic.assignSortedDeficiencyIdsOnLock(current_state);
                }
                // Uppdatera tider en sista gång vid låsning för att vara säker
                state_before_status_change = AuditLogic.recalculateAuditTimes(state_before_status_change);
                
                // Fallback: Om ingen sluttid kunde beräknas (t.ex. gamla data utan timestamps), sätt sluttid till nu
                if (!state_before_status_change.endTime) {
                    timeUpdate.endTime = get_current_iso_datetime_utc_internal();
                }
            } 
            else if (newStatus === 'in_progress' && current_state.auditStatus === 'locked') {
                // Ta bort alla ID:n när granskningen låses upp
                state_before_status_change = AuditLogic.removeAllDeficiencyIds(current_state);
                // Nollställ endTime när vi låser upp, eftersom granskningen nu är pågående
                timeUpdate.endTime = null; 
                state_before_status_change = AuditLogic.recalculateAuditTimes(state_before_status_change);
            } 
            else if (newStatus === 'in_progress' && current_state.auditStatus === 'not_started') {
                // Ta bort alla ID:n när granskningen startas
                state_before_status_change = AuditLogic.removeAllDeficiencyIds(current_state);
                // Nollställ tider vid omstart (eller låt dem vara om vi vill behålla historik?)
                // Enligt instruktion ska vi utgå från interaktioner, så recalculateAuditTimes borde hantera det korrekt
                // om vi inte nollställer timestamps i resultaten.
                // Om 'not_started' -> 'in_progress' är det en ny granskning eller återupptagen.
                state_before_status_change = AuditLogic.recalculateAuditTimes(state_before_status_change);
            }

            return { ...state_before_status_change, auditStatus: newStatus };

        case ActionTypes.REPLACE_RULEFILE_AND_RECONCILE:
            if (!action.payload || !action.payload.ruleFileContent || !action.payload.samples) {
                console.error('[State.js] REPLACE_RULEFILE_AND_RECONCILE: Invalid payload.');
                return current_state;
            }
            return {
                ...action.payload,
                saveFileVersion: APP_STATE_VERSION,
                ruleFileOriginalContentString: null,
                ruleFileOriginalFilename: ''
            };

        case ActionTypes.SET_RULE_FILE_CONTENT:
            return {
                ...current_state,
                ruleFileContent: action.payload.ruleFileContent
            };

        case ActionTypes.UPDATE_RULEFILE_CONTENT:
            return {
                ...current_state,
                ruleFileContent: {
                    ...current_state.ruleFileContent,
                    ...action.payload.ruleFileContent
                }
            };

        case ActionTypes.SET_RULEFILE_EDIT_BASELINE:
            return {
                ...current_state,
                ruleFileOriginalContentString: action.payload.originalRuleFileContentString,
                ruleFileOriginalFilename: action.payload.originalRuleFileFilename
            };
        
        case ActionTypes.SET_UI_FILTER_SETTINGS:
            // Synkronisera sortBy till allRequirementsFilter om det finns i payload
            const updated_requirement_list_filter = {
                ...(current_state.uiSettings?.requirementListFilter || {}),
                ...action.payload
            };
            const updated_all_requirements_filter = action.payload.sortBy !== undefined
                ? {
                    ...(current_state.uiSettings?.allRequirementsFilter || {}),
                    sortBy: action.payload.sortBy
                }
                : (current_state.uiSettings?.allRequirementsFilter || {});
            
            return {
                ...current_state,
                uiSettings: {
                    ...current_state.uiSettings,
                    requirementListFilter: updated_requirement_list_filter,
                    allRequirementsFilter: updated_all_requirements_filter
                }
            };
        
        case ActionTypes.SET_ALL_REQUIREMENTS_FILTER_SETTINGS:
            // Synkronisera sortBy till requirementListFilter om det finns i payload
            const updated_all_req_filter = {
                ...(current_state.uiSettings?.allRequirementsFilter || {}),
                ...action.payload
            };
            const updated_req_list_filter = action.payload.sortBy !== undefined
                ? {
                    ...(current_state.uiSettings?.requirementListFilter || {}),
                    sortBy: action.payload.sortBy
                }
                : (current_state.uiSettings?.requirementListFilter || {});
            
            return {
                ...current_state,
                uiSettings: {
                    ...current_state.uiSettings,
                    allRequirementsFilter: updated_all_req_filter,
                    requirementListFilter: updated_req_list_filter
                }
            };
        
        case ActionTypes.SET_REQUIREMENT_AUDIT_SIDEBAR_SETTINGS:
            return {
                ...current_state,
                uiSettings: {
                    ...current_state.uiSettings,
                    requirementAuditSidebar: {
                        ...(current_state.uiSettings?.requirementAuditSidebar || {}),
                        ...action.payload
                    }
                }
            };

        default:
            return current_state;
    }
}


function dispatch(action) {
    if (!action || typeof action.type !== 'string') {
        console.error('[State.js] Invalid action dispatched. Action must be an object with a "type" property.', action);
        return Promise.reject(new Error('Invalid action'));
    }
    
    // Om vi redan dispatchar, lägg till i kö istället för att köra direkt
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
        await execute_single_dispatch(action);
        
        // Processa alla väntande actions i kön
        while (dispatch_queue.length > 0) {
            const { action: queuedAction, resolve, reject } = dispatch_queue.shift();
            try {
                await execute_single_dispatch(queuedAction);
                resolve();
            } catch (error) {
                reject(error);
            }
        }
    } finally {
        is_dispatching = false;
    }
}

function execute_single_dispatch(action) {
    return new Promise((resolve, reject) => {
        let state_before_dispatch = null;
        let state_after_reducer = null;
        
        try {
            // Spara tillståndet innan dispatch för potentiell återställning
            state_before_dispatch = JSON.parse(JSON.stringify(internal_state));
            
            const previous_state_for_comparison = internal_state;
            state_after_reducer = root_reducer(internal_state, action);
            
            if (state_after_reducer !== previous_state_for_comparison) {
                // Validera att det nya tillståndet är giltigt innan vi använder det
                if (!state_after_reducer || typeof state_after_reducer !== 'object') {
                    throw new Error(`Reducer returned invalid state for action type: ${action.type}`);
                }
                
                // Kontrollera att kritiska egenskaper finns kvar
                if (!state_after_reducer.hasOwnProperty('saveFileVersion') || 
                    !state_after_reducer.hasOwnProperty('auditStatus')) {
                    throw new Error(`Reducer returned state missing critical properties for action type: ${action.type}`);
                }
                
                internal_state = state_after_reducer;
                
                // Spara till session storage med felhantering
                try {
                    saveStateToSessionStorage(internal_state);
                } catch (saveError) {
                    console.warn('[State.js] Failed to save state to sessionStorage:', saveError);
                    // Fortsätt ändå, detta är inte kritiskt
                }

                // Notifiera listeners med felhantering
                try {
                    notify_listeners();
                } catch (listenerError) {
                    console.warn('[State.js] Error notifying state listeners:', listenerError);
                    // Listener-fel ska inte stoppa state-uppdateringen
                }
            }
            
            resolve();
            
        } catch (error) {
            console.error('[State.js] Critical error in dispatch or reducer:', error, 'Action:', action);
            
            // Om state blev korrupt, försök återställa från backup
            if (state_before_dispatch && state_before_dispatch !== internal_state) {
                console.warn('[State.js] Attempting to restore state from backup due to reducer error');
                try {
                    internal_state = state_before_dispatch;
                    
                    // Spara den återställda staten
                    saveStateToSessionStorage(internal_state);
                    
                    // Notifiera listeners om återställningen
                    notify_listeners();
                    
                    console.info('[State.js] State successfully restored from backup');
                } catch (restoreError) {
                    console.error('[State.js] Failed to restore state from backup:', restoreError);
                    // Om återställning misslyckas, logga felet men låt applikationen fortsätta
                }
            }
            
            // Kasta felet vidare för att låta anropande kod hantera det om möjligt
            reject(new Error(`State dispatch failed for action type '${action.type}': ${error.message}`));
        }
    });
}

function getState() {
    try {
        return JSON.parse(JSON.stringify(internal_state));
    } catch (error) {
        console.error('[State.js] Failed to serialize state in getState:', error);
        // Returnera en minimal säker state om serialisering misslyckas
        return {
            ...initial_state,
            saveFileVersion: APP_STATE_VERSION,
            auditStatus: 'error'
        };
    }
}

function subscribe(listener_function) {
    if (typeof listener_function !== 'function') {
        console.error('[State.js] Listener must be a function.');
        return () => {};
    }
    listeners.push(listener_function);
    return () => {
        listeners = listeners.filter(l => l !== listener_function);
    };
}

function notify_listeners() {
    const currentSnapshot = getState();
    setTimeout(() => {
        listeners.forEach(listener => {
            try {
                listener(currentSnapshot);
            } catch (error) {
                console.error('[State.js] Error in listener function:', error);
            }
        });
    }, 0);
}

function loadStateFromSessionStorage() {
    const serializedState = sessionStorage.getItem(APP_STATE_KEY);
    if (serializedState === null) {
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
    }
    try {
        const storedState = JSON.parse(serializedState);
        if (storedState.saveFileVersion && storedState.saveFileVersion.startsWith(APP_STATE_VERSION.split('.')[0])) {
            const mergedState = {
                ...JSON.parse(JSON.stringify(initial_state)),
                ...storedState,
                saveFileVersion: APP_STATE_VERSION
            };
            return mergedState;
        } else {
            sessionStorage.removeItem(APP_STATE_KEY);
            return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
        }
    } catch (e) {
        sessionStorage.removeItem(APP_STATE_KEY);
        return { ...initial_state, saveFileVersion: APP_STATE_VERSION };
    }
}

function saveStateToSessionStorage(state_to_save) {
    try {
        const complete_state_to_save = { ...state_to_save, saveFileVersion: APP_STATE_VERSION };
        const serializedState = JSON.stringify(complete_state_to_save);
        sessionStorage.setItem(APP_STATE_KEY, serializedState);
    } catch (e) {
        console.error("[State.js] Could not save state to sessionStorage:", e);
        if (window.NotificationComponent && typeof window.NotificationComponent.show_global_message === 'function' && typeof window.Translation?.t === 'function') {
            window.NotificationComponent.show_global_message(window.Translation.t('critical_error_saving_session_data_lost'), 'error');
        }
    }
}

function initState() {
    internal_state = loadStateFromSessionStorage();
    if (AuditLogic && typeof AuditLogic.updateIncrementalDeficiencyIds === 'function') {
        internal_state = AuditLogic.updateIncrementalDeficiencyIds(internal_state);
        saveStateToSessionStorage(internal_state);
    } else {
        console.error("[State.js] AuditLogic not available during initState. State may be inconsistent.");
    }
}

export { 
    dispatch, 
    getState, 
    subscribe, 
    initState, 
    ActionTypes as StoreActionTypes, 
    initial_state as StoreInitialState
};
