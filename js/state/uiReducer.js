// js/state/uiReducer.js
import { ActionTypes } from './actionTypes.js';

export function uiReducer(current_state, action) {
    switch (action.type) {
        case ActionTypes.SET_UI_FILTER_SETTINGS: {
            const updated_requirement_list_filter = {
                ...(current_state.uiSettings?.requirementListFilter || {}),
                ...action.payload
            };
            const updated_all_requirements_filter = action.payload.sortBy !== undefined
                ? { ...(current_state.uiSettings?.allRequirementsFilter || {}), sortBy: action.payload.sortBy }
                : (current_state.uiSettings?.allRequirementsFilter || {});
            return {
                ...current_state,
                uiSettings: {
                    ...current_state.uiSettings,
                    requirementListFilter: updated_requirement_list_filter,
                    allRequirementsFilter: updated_all_requirements_filter
                }
            };
        }
        case ActionTypes.SET_ALL_REQUIREMENTS_FILTER_SETTINGS: {
            const updated_all_req_filter = {
                ...(current_state.uiSettings?.allRequirementsFilter || {}),
                ...action.payload
            };
            const updated_req_list_filter = action.payload.sortBy !== undefined
                ? { ...(current_state.uiSettings?.requirementListFilter || {}), sortBy: action.payload.sortBy }
                : (current_state.uiSettings?.requirementListFilter || {});
            return {
                ...current_state,
                uiSettings: {
                    ...current_state.uiSettings,
                    allRequirementsFilter: updated_all_req_filter,
                    requirementListFilter: updated_req_list_filter
                }
            };
        }
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
