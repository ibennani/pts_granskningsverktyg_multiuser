// js/state/rulefileReducer.js
import { ActionTypes } from './actionTypes.js';
import { APP_STATE_VERSION } from './initialState.js';

export function rulefileReducer(current_state, action) {
    switch (action.type) {
        case ActionTypes.REPLACE_RULEFILE_AND_RECONCILE:
            if (!action.payload || !action.payload.ruleFileContent || !action.payload.samples) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[State] REPLACE_RULEFILE_AND_RECONCILE: Invalid payload.');
                return current_state;
            }
            return {
                ...action.payload,
                saveFileVersion: APP_STATE_VERSION,
                ruleFileOriginalContentString: null,
                ruleFileOriginalFilename: ''
            };
        case ActionTypes.SET_RULE_FILE_CONTENT:
            return { ...current_state, ruleFileContent: action.payload.ruleFileContent };
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
        case ActionTypes.REPLACE_RULEFILE_FROM_REMOTE: {
            const remote_content = action.payload?.ruleFileContent;
            if (!remote_content || typeof remote_content !== 'object') return current_state;
            return {
                ...current_state,
                ruleFileContent: remote_content,
                ruleFileServerVersion: action.payload.version ?? current_state.ruleFileServerVersion ?? 0
            };
        }
        default:
            return current_state;
    }
}
