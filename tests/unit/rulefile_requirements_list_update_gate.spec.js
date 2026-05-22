import { describe, test, expect } from '@jest/globals';
import {
    fingerprint_rulefile_requirements_list_view,
    should_repopulate_rulefile_requirements_list
} from '../../js/logic/rulefile_requirements_list_update_gate.js';

describe('rulefile_requirements_list_update_gate', () => {
    test('skippar irrelevanta audit-actions', () => {
        expect(should_repopulate_rulefile_requirements_list('UPDATE_REQUIREMENT_RESULT')).toBe(false);
        expect(should_repopulate_rulefile_requirements_list('UPDATE_METADATA')).toBe(false);
    });

    test('tillåter regelfil- och filter-actions', () => {
        expect(should_repopulate_rulefile_requirements_list('UPDATE_RULEFILE_CONTENT')).toBe(true);
        expect(should_repopulate_rulefile_requirements_list('SET_UI_FILTER_SETTINGS')).toBe(true);
        expect(should_repopulate_rulefile_requirements_list('DELETE_REQUIREMENT_DEFINITION')).toBe(true);
    });

    test('saknad action_type repopulerar (t.ex. språkbyte)', () => {
        expect(should_repopulate_rulefile_requirements_list(undefined)).toBe(true);
        expect(should_repopulate_rulefile_requirements_list(null)).toBe(true);
    });

    test('fingerprint ändras när titel ändras', () => {
        const filter = { searchText: '', sortBy: 'ref_asc' };
        const before = fingerprint_rulefile_requirements_list_view(filter, [{ key: '1', title: 'A', standardReference: { text: '1.1' } }]);
        const after = fingerprint_rulefile_requirements_list_view(filter, [{ key: '1', title: 'B', standardReference: { text: '1.1' } }]);
        expect(before).not.toBe(after);
    });

    test('fingerprint oförändrat vid samma lista och filter', () => {
        const filter = { searchText: 'x', sortBy: 'title_asc' };
        const items = [{ key: '1', title: 'A', standardReference: { text: '1.1' } }];
        const a = fingerprint_rulefile_requirements_list_view(filter, items);
        const b = fingerprint_rulefile_requirements_list_view(filter, items);
        expect(a).toBe(b);
    });
});
