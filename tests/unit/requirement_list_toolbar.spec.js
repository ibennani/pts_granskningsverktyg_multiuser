/**
 * Tester för kravlistans verktygsrad – söktext ska inte återställas vid filterändring.
 */
import { describe, test, expect, jest } from '@jest/globals';
import { RequirementListToolbarComponent } from '../../js/components/RequirementListToolbarComponent.js';

describe('RequirementListToolbarComponent', () => {
    test('filterändring använder aktuell söktext från fältet trots väntande debounce', () => {
        const on_change = jest.fn();
        const search_input = document.createElement('input');
        search_input.id = 'req-list-search';
        const container = document.createElement('div');
        container.appendChild(search_input);

        RequirementListToolbarComponent.root = container;
        RequirementListToolbarComponent._search_input_ref = search_input;
        RequirementListToolbarComponent.component_state = {
            searchText: 'gammal text',
            sortBy: 'ref_asc',
            status: { passed: true, failed: true }
        };
        RequirementListToolbarComponent.on_change_callback = on_change;
        RequirementListToolbarComponent._search_debounce_timer = setTimeout(() => {}, 1000);

        search_input.value = '';
        RequirementListToolbarComponent.update_and_notify({ status: { passed: true, failed: false } });

        expect(on_change).toHaveBeenCalledWith({
            searchText: '',
            sortBy: 'ref_asc',
            status: { passed: true, failed: false }
        });
        expect(RequirementListToolbarComponent._search_debounce_timer).toBeNull();
    });

    test('update_values skriver inte tillbaka gammal state över tomt sökfält', () => {
        const search_input = document.createElement('input');
        search_input.id = 'req-list-search';
        search_input.value = '';
        const container = document.createElement('div');
        container.appendChild(search_input);

        RequirementListToolbarComponent.root = container;
        RequirementListToolbarComponent._search_input_ref = search_input;
        RequirementListToolbarComponent.component_state = {
            searchText: 'gammal text',
            sortBy: 'ref_asc',
            status: {}
        };
        RequirementListToolbarComponent.component_config = { showStatusFilter: false };
        RequirementListToolbarComponent._search_debounce_timer = null;

        RequirementListToolbarComponent.update_values();

        expect(search_input.value).toBe('');
        expect(RequirementListToolbarComponent.component_state.searchText).toBe('');
    });

    test('sync_search_from_dom skickar tom söktext när fältet är raderat', () => {
        const on_change = jest.fn();
        const search_input = document.createElement('input');
        search_input.value = '';
        RequirementListToolbarComponent._search_input_ref = search_input;
        RequirementListToolbarComponent.component_state = { searchText: 'kvar i state', sortBy: 'ref_asc', status: {} };
        RequirementListToolbarComponent.on_change_callback = on_change;
        RequirementListToolbarComponent._search_debounce_timer = setTimeout(() => {}, 1000);

        RequirementListToolbarComponent.sync_search_from_dom();

        expect(on_change).toHaveBeenCalledWith(expect.objectContaining({ searchText: '' }));
        expect(RequirementListToolbarComponent._search_debounce_timer).toBeNull();
    });
});
