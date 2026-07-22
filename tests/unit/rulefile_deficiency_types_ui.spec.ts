/**
 * Enhetstester för bristtyper-tabell och redigeringsmodal.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render_deficiency_types_editor } from '../../js/components/rulefile_sections/rulefile_deficiency_types_ui.ts';

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
            if (typeof opts.html_content === 'string') {
                el.innerHTML = opts.html_content;
            }
            const attrs = opts.attributes as Record<string, string> | undefined;
            if (attrs) {
                for (const [key, value] of Object.entries(attrs)) {
                    el.setAttribute(key, value);
                }
            }
            return el;
        },
        get_icon_svg: () => '<svg></svg>',
    };
}

describe('rulefile_deficiency_types_ui', () => {
    let container: HTMLDivElement;

    async function flush_animation_frames(): Promise<void> {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        window.matchMedia = ((query: string) => ({
            matches: query.includes('prefers-reduced-motion: reduce'),
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
            onchange: null,
        })) as typeof window.matchMedia;
        HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
            this.setAttribute('open', '');
        };
        HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
            this.removeAttribute('open');
            this.dispatchEvent(new Event('close'));
        };
    });

    afterEach(() => {
        container.remove();
        document.querySelectorAll('.deficiency-type-edit-dialog').forEach((el) => el.remove());
    });

    test('Redigera-knapp öppnar modal med del 1 och del 2', async () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        render_deficiency_types_editor(ctx, container, {
            requirements: {
                req1: {
                    id: 'req1',
                    title: 'Krav 1',
                    DeficiencyType: { PrimaryText: 'Del 1', SecondaryText: 'Del 2' },
                },
            },
        });

        const actions_header = container.querySelector('.deficiency-types-actions-header');
        expect(actions_header?.classList.contains('visually-hidden')).toBe(false);
        expect(actions_header?.textContent).toBe(
            'rulefile_classifications_deficiency_types_actions_column'
        );
        expect(actions_header?.querySelector('.visually-hidden')).toBeNull();
        expect(actions_header?.getAttribute('scope')).toBe('col');

        const edit_button = container.querySelector('.deficiency-types-row-edit-button') as HTMLButtonElement;
        expect(edit_button).not.toBeNull();
        edit_button.click();

        const dialog = document.querySelector('.deficiency-type-edit-dialog') as HTMLDialogElement;
        expect(dialog).not.toBeNull();
        expect(dialog.hasAttribute('open')).toBe(true);
        await flush_animation_frames();
        expect(dialog.classList.contains('modal-dialog--visible')).toBe(true);
        expect(dialog.querySelector('textarea')).not.toBeNull();
        expect(dialog.querySelectorAll('textarea').length).toBe(2);
    });

    test('Redigera-knapp har aria-label med kravnamn från vänster kolumn', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: {
                t: (key: string, opts?: Record<string, unknown>) => {
                    if (key === 'rulefile_classifications_deficiency_types_edit_row_aria') {
                        return `Redigera bristtyp ${String(opts?.requirementTitle ?? '')}`;
                    }
                    return key;
                },
            },
        };
        render_deficiency_types_editor(ctx, container, {
            requirements: {
                req1: {
                    id: 'req1',
                    title: 'Krav 1',
                    DeficiencyType: { PrimaryText: 'Del 1', SecondaryText: 'Del 2' },
                },
            },
        });

        const edit_button = container.querySelector('.deficiency-types-row-edit-button') as HTMLButtonElement;
        expect(edit_button.getAttribute('aria-label')).toBe('Redigera bristtyp Krav 1');
    });

    test('Stängning av modal återför fokus till Redigera-knappen', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        render_deficiency_types_editor(ctx, container, {
            requirements: {
                req1: { id: 'req1', title: 'Krav 1', DeficiencyType: {} },
            },
        });

        const edit_button = container.querySelector('.deficiency-types-row-edit-button') as HTMLButtonElement;
        edit_button.click();

        const close_button = document.querySelector(
            '.deficiency-type-edit-dialog button[type="button"]'
        ) as HTMLButtonElement;
        close_button.click();

        expect(document.querySelector('.deficiency-type-edit-dialog')).toBeNull();
        expect(document.activeElement).toBe(edit_button);
    });
});
