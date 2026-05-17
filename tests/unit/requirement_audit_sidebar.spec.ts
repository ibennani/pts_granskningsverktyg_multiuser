/**
 * Tester för kravgranskningens högerspaltsfilter vid lägesbyte.
 */
import { describe, test, expect, jest } from '@jest/globals';
import { RequirementAuditSidebarComponent } from '../../js/components/RequirementAuditSidebarComponent.js';

describe('RequirementAuditSidebarComponent', () => {
    test('sync_search_text_across_modes sätter samma söktext i båda lägen', () => {
        const sidebar = new RequirementAuditSidebarComponent();
        sidebar.filters_by_mode.sample_requirements.searchText = 'gammal';
        sidebar.filters_by_mode.requirement_samples.searchText = '';

        sidebar.sync_search_text_across_modes('ny sökning');

        expect(sidebar.filters_by_mode.sample_requirements.searchText).toBe('ny sökning');
        expect(sidebar.filters_by_mode.requirement_samples.searchText).toBe('ny sökning');
    });

    test('handle_mode_change behåller söktext från fältet vid lägesbyte', () => {
        const sidebar = new RequirementAuditSidebarComponent();
        sidebar.selected_mode = 'sample_requirements';
        sidebar.filters_by_mode.requirement_samples.searchText = '';
        sidebar.requirements_filter_component = {
            flush_search_debounce: jest.fn(),
            get_pending_search_text: () => 'behållen text'
        };
        sidebar.save_settings_to_state = jest.fn();
        sidebar.render = jest.fn();

        sidebar.handle_mode_change({ target: { value: 'requirement_samples' } });

        expect(sidebar.selected_mode).toBe('requirement_samples');
        expect(sidebar.filters_by_mode.requirement_samples.searchText).toBe('behållen text');
        expect(sidebar.filters_by_mode.sample_requirements.searchText).toBe('behållen text');
    });
});
