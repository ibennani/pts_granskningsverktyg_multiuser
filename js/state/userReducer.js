// js/state/userReducer.js
import { ActionTypes } from './actionTypes.js';

export function userReducer(current_state, action) {
    switch (action.type) {
        case ActionTypes.SET_MANAGE_USERS_TEXT:
            return {
                ...current_state,
                manageUsersText: typeof action.payload === 'string' ? action.payload : ''
            };
        default:
            return current_state;
    }
}
