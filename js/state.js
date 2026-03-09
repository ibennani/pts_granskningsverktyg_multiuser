// js/state.js – re-export från js/state/index.js (uppdelad state-arkitektur)
export {
    dispatch,
    getState,
    subscribe,
    initState,
    StoreActionTypes,
    StoreInitialState,
    loadStateFromLocalStorageBackup,
    clearLocalStorageBackup,
    updateBackupRestorePosition,
    APP_STATE_KEY
} from './state/index.js';
