/**
 * Tester för kravgranskningens högerspaltsfilter vid lägesbyte.
 */
import { describe, test, expect, jest } from '@jest/globals';
import { create_element } from '../../js/dom/create_element.js';
import { RequirementAuditSidebarComponent } from '../../js/components/RequirementAuditSidebarComponent.js';

describe('RequirementAuditSidebarComponent', () => {
    test('create_sidebar_nav_entry renderar span för aktiv post och länk för inaktiv', () => {
        const sidebar = new RequirementAuditSidebarComponent();
        sidebar.Helpers = { create_element };
        sidebar.build_non_anchor_href = jest.fn().mockReturnValue('#ra?s=s1&r=r1');

        const active = sidebar.create_sidebar_nav_entry({
            is_active: true,
            heading_text: 'Krav 1',
            aria_label: 'Krav 1, Ingen anmärkning',
            sample_id: 's1',
            requirement_id: 'r1'
        });
        expect(active.tagName).toBe('SPAN');
        expect(active.getAttribute('aria-current')).toBe('page');
        expect(active.getAttribute('aria-label')).toBe('Krav 1, Ingen anmärkning');
        expect(active.querySelector('h3')?.textContent).toBe('Krav 1');

        const link = sidebar.create_sidebar_nav_entry({
            is_active: false,
            heading_text: 'Krav 2',
            aria_label: 'Krav 2, Underkänt',
            sample_id: 's1',
            requirement_id: 'r2'
        });
        expect(link.tagName).toBe('A');
        expect(link.getAttribute('data-requirement-sidebar-link')).toBe('true');
        expect(link.getAttribute('href')).toBe('#ra?s=s1&r=r1');
    });

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
