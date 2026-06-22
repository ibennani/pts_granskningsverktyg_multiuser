import { jest, describe, test, expect, beforeEach } from '@jest/globals';

async function flush_notify_listeners() {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

describe('state (js/state)', () => {
    beforeEach(() => {
        jest.resetModules();
        sessionStorage.clear();
        try {
            localStorage.clear();
        } catch {
            /* ignorera */
        }
    });

    test('initState() skapar ett giltigt initialstate', async () => {
        const { initState, getState, StoreInitialState } = await import('../../js/state/index.js');
        initState();
        const s = getState();
        expect(s.saveFileVersion).toBe(StoreInitialState.saveFileVersion);
        expect(s.auditStatus).toBe('not_started');
        expect(s.uiSettings).toBeDefined();
        expect(s.samples).toEqual([]);
    });

    test('dispatch() med en känd action uppdaterar state korrekt', async () => {
        const { initState, dispatch, getState, StoreActionTypes } = await import('../../js/state/index.js');
        initState();
        await dispatch({
            type: StoreActionTypes.SET_UI_FILTER_SETTINGS,
            payload: { searchText: 'test-sök' },
        });
        const s = getState();
        expect(s.uiSettings.requirementListFilter.searchText).toBe('test-sök');
    });

    test('subscribe() anropas när state förändras', async () => {
        const { initState, dispatch, subscribe, StoreActionTypes } = await import('../../js/state/index.js');
        initState();
        const fn = jest.fn();
        subscribe(fn);
        await dispatch({
            type: StoreActionTypes.SET_UI_FILTER_SETTINGS,
            payload: { searchText: 'x' },
        });
        await flush_notify_listeners();
        expect(fn).toHaveBeenCalled();
        const call_arg = fn.mock.calls[fn.mock.calls.length - 1][0];
        expect(call_arg.uiSettings.requirementListFilter.searchText).toBe('x');
    });

    test('getState() returnerar nuvarande state', async () => {
        const { initState, dispatch, getState, StoreActionTypes } = await import('../../js/state/index.js');
        initState();
        await dispatch({
            type: StoreActionTypes.SET_UI_FILTER_SETTINGS,
            payload: { searchText: 'y' },
        });
        const a = getState();
        const b = getState();
        expect(a.uiSettings.requirementListFilter.searchText).toBe('y');
        expect(b.uiSettings.requirementListFilter.searchText).toBe('y');
    });

    test('okänd action-typ lämnar state oförändrat', async () => {
        const { initState, dispatch, getState } = await import('../../js/state/index.js');
        initState();
        const before = getState();
        await dispatch({ type: 'UNKNOWN_ACTION_TEST_XYZ', payload: {} });
        const after = getState();
        expect(after).toEqual(before);
    });

    test('initState() normaliserar korrupt samples-fält från sessionStorage', async () => {
        const { APP_STATE_KEY } = await import('../../js/state/index.js');
        const { APP_STATE_VERSION } = await import('../../js/state/initialState.js');
        sessionStorage.setItem(
            APP_STATE_KEY,
            JSON.stringify({
                saveFileVersion: APP_STATE_VERSION,
                samples: {},
                archivedRequirementResults: 'x',
                auditMetadata: { caseNumber: '', actorName: '', actorLink: '', auditorName: '', caseHandler: '', internalComment: '' },
                auditStatus: 'in_progress',
                ruleFileContent: null
            })
        );
        jest.resetModules();
        const { initState, getState } = await import('../../js/state/index.js');
        initState();
        const s = getState();
        expect(Array.isArray(s.samples)).toBe(true);
        expect(s.samples).toEqual([]);
        expect(Array.isArray(s.archivedRequirementResults)).toBe(true);
        expect(s.archivedRequirementResults).toEqual([]);
    });

    test('subscribe anropar alla lyssnare vid dispatch', async () => {
        const { initState, dispatch, subscribe, StoreActionTypes } = await import('../../js/state/index.js');
        initState();
        const a = jest.fn();
        const b = jest.fn();
        subscribe(a);
        subscribe(b);
        await dispatch({
            type: StoreActionTypes.SET_UI_FILTER_SETTINGS,
            payload: { searchText: 'multi' },
        });
        await flush_notify_listeners();
        expect(a).toHaveBeenCalled();
        expect(b).toHaveBeenCalled();
    });

    test('om en lyssnare kastar fortsätter övriga att anropas', async () => {
        const { initState, dispatch, subscribe, StoreActionTypes } = await import('../../js/state/index.js');
        initState();
        const bad = jest.fn(() => {
            throw new Error('lyssnare fel');
        });
        const good = jest.fn();
        subscribe(bad);
        subscribe(good);
        await dispatch({
            type: StoreActionTypes.SET_UI_FILTER_SETTINGS,
            payload: { searchText: 'felfri' },
        });
        await flush_notify_listeners();
        expect(bad).toHaveBeenCalled();
        expect(good).toHaveBeenCalled();
    });
});
