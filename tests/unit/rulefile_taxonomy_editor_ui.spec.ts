/**
 * Enhetstester för rulefile_taxonomy_editor_ui.
 */
import { describe, test, expect } from '@jest/globals';
import {
    append_draft_taxonomy_on_save,
    render_taxonomy_editor_ui,
    resolve_taxonomy_key_after_save,
} from '../../js/components/rulefile_sections/rulefile_taxonomy_editor_ui.ts';
import { finalize_taxonomy_ids_for_persist } from '../../js/logic/taxonomy_persist.ts';

function create_helpers() {
    return {
        create_element: (tag: string, opts: Record<string, unknown> = {}) => {
            const el = document.createElement(tag);
            const class_name = opts.class_name;
            if (typeof class_name === 'string') {
                el.className = class_name;
            } else if (Array.isArray(class_name)) {
                el.className = class_name.join(' ');
            }
            if (typeof opts.text_content === 'string') {
                el.textContent = opts.text_content;
            }
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
    };
}

function create_ctx() {
    return {
        Helpers: create_helpers(),
        Translation: {
            t: (key: string, opts?: Record<string, unknown>) => {
                const labels: Record<string, string> = {
                    rulefile_classifications_taxonomy_single_edit_intro: 'Redigera intro',
                    rulefile_classifications_taxonomy_create_intro: 'Skapa intro',
                    rulefile_classifications_taxonomy_name_field_label: 'Taxonominamn',
                    rulefile_classifications_taxonomy_principles_heading: 'Principer',
                    rulefile_classifications_taxonomy_principles_edit_hint: 'Principer hint',
                    rulefile_classifications_taxonomy_principles_empty: 'Inga principer ännu',
                    rulefile_classifications_taxonomy_principle_field_label: 'Princip {number}',
                    rulefile_classifications_taxonomy_add_principle: 'Lägg till princip',
                    rulefile_classifications_taxonomy_remove_principle: 'Ta bort princip',
                    rulefile_classifications_taxonomy_not_found: 'Hittades inte',
                    rulefile_metadata_untitled_item: 'Namnlös',
                };
                let text = labels[key] ?? key;
                if (opts?.number) {
                    text = text.replace('{number}', String(opts.number));
                }
                return text;
            },
        },
    };
}

describe('render_taxonomy_editor_ui', () => {
    test('renderar redigering för befintlig taxonomi', () => {
        const container = document.createElement('div');
        const working = {
            taxonomies: [
                {
                    id: 'wcag22-pour',
                    label: 'WCAG 2.2 POUR',
                    concepts: [{ id: 'a', label: 'Princip A' }],
                },
            ],
        };
        const ok = render_taxonomy_editor_ui(create_ctx(), container, working, {
            taxonomy_key: 'wcag22-pour',
        });

        expect(ok).toBe(true);
        expect(container.querySelector('.taxonomy-editor')).not.toBeNull();
        expect(container.querySelector('.taxonomy-editor-primary-field')).toBeNull();
        const name_input = container.querySelector('.taxonomy-editor-name-field input') as HTMLInputElement;
        expect(name_input?.value).toBe('WCAG 2.2 POUR');
        expect(name_input?.classList.contains('form-control')).toBe(true);
        expect(name_input?.classList.contains('dropdown-select')).toBe(false);
        expect(container.querySelector('.taxonomy-editor-name-control')).toBeNull();
        expect(container.querySelector('.taxonomy-editor-principle-row')).not.toBeNull();
        expect(container.querySelector('.taxonomy-editor-principles-section')).not.toBeNull();
        expect(container.querySelector('.taxonomy-editor-principles-hint')?.textContent).toBe('Principer hint');
        expect(container.querySelector('.taxonomy-editor-add-principle-button')).not.toBeNull();
        expect(container.querySelector('.taxonomy-editor-principles-empty')).toBeNull();
    });

    test('visar tomt tillstånd när inga principer finns', () => {
        const container = document.createElement('div');
        const working = {
            taxonomies: [{ id: 'empty-tax', label: 'Tom taxonomi', concepts: [] }],
        };
        const ok = render_taxonomy_editor_ui(create_ctx(), container, working, {
            taxonomy_key: 'empty-tax',
        });

        expect(ok).toBe(true);
        expect(container.querySelector('.taxonomy-editor-principles-empty')).not.toBeNull();
        expect(container.querySelector('.taxonomy-editor-principles-empty-text')?.textContent).toBe(
            'Inga principer ännu'
        );
        expect(
            container.querySelector('.taxonomy-editor-principles-empty .taxonomy-editor-add-principle-button')
        ).not.toBeNull();
        expect(
            container.querySelector('.taxonomy-editor-principles-actions .taxonomy-editor-add-principle-button')
        ).toBeNull();
    });

    test('renderar skapa-läge med utkast', () => {
        const container = document.createElement('div');
        const working = { taxonomies: [] as unknown[] };
        const draft = { id: '', label: 'Ny taxonomi', concepts: [] as unknown[] };
        const ok = render_taxonomy_editor_ui(create_ctx(), container, working, {
            is_create: true,
            draft_taxonomy: draft,
        });

        expect(ok).toBe(true);
        expect(container.querySelector('.taxonomy-editor-intro')?.textContent).toBe('Skapa intro');
        expect(container.querySelector('.taxonomy-editor-principles-empty')).not.toBeNull();
    });
});

describe('append_draft_taxonomy_on_save', () => {
    test('lägger till utkast och ger nyckel efter persist', () => {
        const working = { taxonomies: [] as { id?: string; label?: string; concepts?: unknown[] }[] };
        const saved = append_draft_taxonomy_on_save(working, {
            id: '',
            label: 'Min taxonomi',
            concepts: [{ id: '', label: 'P1' }],
        });
        finalize_taxonomy_ids_for_persist(working);
        const key = resolve_taxonomy_key_after_save(working, saved);
        expect(working.taxonomies.length).toBe(1);
        expect(key).toBe('min-taxonomi');
    });
});
