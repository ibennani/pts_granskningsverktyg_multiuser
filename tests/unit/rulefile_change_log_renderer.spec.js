/**
 * Tester för rulefile_change_log_renderer.js
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { render_rulefile_change_log } from '../../js/logic/rulefile_change_log_renderer.js';

function mock_create_element(tag, opts = {}) {
    const el = document.createElement(tag);
    if (opts.class_name) {
        el.className = Array.isArray(opts.class_name) ? opts.class_name.join(' ') : opts.class_name;
    }
    if (opts.text_content) {
        el.textContent = opts.text_content;
    }
    if (opts.attributes) {
        Object.entries(opts.attributes).forEach(([k, v]) => {
            el.setAttribute(k, String(v));
        });
    }
    return el;
}

describe('render_rulefile_change_log', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('skapar tre accordeoner med aria-kopplingar och togglar aria-expanded', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const t = (k) => ({
            update_rulefile_change_log_section_added: 'Nya krav',
            update_rulefile_change_log_section_removed: 'Borttagna krav',
            update_rulefile_change_log_section_updated: 'Uppdaterade krav',
            no_items_in_category: 'Inga',
            update_rulefile_change_log_new_check_fallback: 'Ny kontrollpunkt'
        }[k] || k);

        render_rulefile_change_log({
            container,
            t,
            Helpers: { create_element: mock_create_element },
            report: { added_requirements: [], removed_requirements: [], updated_requirements: [] },
            old_requirements: {},
            new_requirements: {}
        });

        const sections = container.querySelectorAll('section.rulefile-change-log__accordion');
        expect(sections.length).toBe(3);

        const first_header = sections[0].querySelector('button.rulefile-change-log__accordion-header');
        expect(first_header).not.toBeNull();
        expect(first_header.getAttribute('type')).toBe('button');
        expect(first_header.getAttribute('aria-expanded')).toBe('false');
        const controls = first_header.getAttribute('aria-controls');
        expect(controls).toBeTruthy();

        const region = sections[0].querySelector(`#${CSS.escape(controls)}`);
        expect(region).not.toBeNull();
        expect(region.getAttribute('role')).toBe('region');
        expect(region.getAttribute('aria-labelledby')).toBe(first_header.getAttribute('id'));

        // Toggle -> aria-expanded ändras
        first_header.click();
        expect(first_header.getAttribute('aria-expanded')).toBe('true');
        first_header.click();
        expect(first_header.getAttribute('aria-expanded')).toBe('false');
    });

    test('visar inte tekniska check-id:n i listan för nya kontrollpunkter', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const t = (k) => ({
            update_rulefile_change_log_section_added: 'Nya krav',
            update_rulefile_change_log_section_removed: 'Borttagna krav',
            update_rulefile_change_log_section_updated: 'Uppdaterade krav',
            update_rulefile_change_log_requirement_changed: 'Ändrat',
            update_rulefile_change_log_changed_parts_prefix: 'Ändrat i',
            update_rulefile_change_log_changed_checks: 'kontrollpunkter eller kriterier',
            update_rulefile_change_log_changed_other: 'övrigt',
            update_rulefile_change_log_new_checks_heading: 'Nya kontrollpunkter',
            update_rulefile_change_log_new_check_fallback: 'Ny kontrollpunkt',
            no_items_in_category: 'Inga'
        }[k] || k);

        const report = {
            added_requirements: [],
            removed_requirements: [],
            updated_requirements: [
                {
                    id: 'req1',
                    title: 'Titel',
                    passCriteriaChanges: {
                        addedChecks: ['new-check-123'],
                        added: [],
                        updated: []
                    }
                }
            ]
        };

        const new_requirements = {
            req1: {
                id: 'req1',
                title: 'Titel',
                checks: [
                    { id: 'new-check-123', condition: 'Kontrollpunktens villkor' }
                ]
            }
        };

        render_rulefile_change_log({
            container,
            t,
            Helpers: { create_element: mock_create_element },
            report,
            old_requirements: {},
            new_requirements
        });

        // Öppna "Uppdaterade krav"
        const updated_header = [...container.querySelectorAll('button.rulefile-change-log__accordion-header')]
            .find((b) => (b.textContent || '').includes('Uppdaterade krav'));
        expect(updated_header).toBeTruthy();
        updated_header.click();

        expect(container.textContent).toContain('Kontrollpunktens villkor');
        expect(container.textContent).not.toContain('new-check-123');
    });

    test('visar en mänsklig sammanfattning även när passCriteriaChanges är tomt', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const t = (k) => ({
            update_rulefile_change_log_section_added: 'Nya krav',
            update_rulefile_change_log_section_removed: 'Borttagna krav',
            update_rulefile_change_log_section_updated: 'Uppdaterade krav',
            update_rulefile_change_log_requirement_changed: 'Detta krav har ändrats.',
            update_rulefile_change_log_changed_parts_prefix: 'Ändrat i',
            update_rulefile_change_log_changed_title: 'titel',
            update_rulefile_change_log_changed_other: 'övrigt',
            no_items_in_category: 'Inga'
        }[k] || k);

        render_rulefile_change_log({
            container,
            t,
            Helpers: { create_element: mock_create_element },
            report: {
                added_requirements: [],
                removed_requirements: [],
                updated_requirements: [
                    { id: 'req1', title: 'Ny titel', passCriteriaChanges: { addedChecks: [], added: [], updated: [] } }
                ]
            },
            old_requirements: { req1: { id: 'req1', title: 'Gammal titel' } },
            new_requirements: { req1: { id: 'req1', title: 'Ny titel' } }
        });

        const updated_header = [...container.querySelectorAll('button.rulefile-change-log__accordion-header')]
            .find((b) => (b.textContent || '').includes('Uppdaterade krav'));
        updated_header.click();

        expect(container.textContent).toContain('Ändrat i');
        expect(container.textContent).toContain('titel');
    });
});

