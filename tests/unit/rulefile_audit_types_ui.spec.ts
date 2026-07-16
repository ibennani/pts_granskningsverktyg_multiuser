/**
 * Enhetstester för granskningstyper-tabell och redigeringsmodal.
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render_audit_types_editor } from '../../js/components/rulefile_sections/rulefile_audit_types_ui.ts';
import { DEFAULT_AUDIT_TYPES } from '../../shared/rulefile/rulefile_audit_types.ts';

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

const sample_metadata = {
    taxonomies: [{ id: 'wcag22-pour', label: 'WCAG 2.2 POUR' }],
    auditTypes: DEFAULT_AUDIT_TYPES.map((row) => ({ ...row })),
};

describe('rulefile_audit_types_ui', () => {
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
        document.querySelectorAll('.audit-type-edit-dialog').forEach((el) => el.remove());
    });

    test('Redigera-knapp öppnar modal med namn och taxonomi', async () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        render_audit_types_editor(ctx, container, { ...sample_metadata });

        expect(container.querySelector('.audit-types-table')).not.toBeNull();
        const actions_header = container.querySelector('.audit-types-actions-header');
        expect(actions_header?.classList.contains('visually-hidden')).toBe(false);
        expect(actions_header?.textContent).toBe(
            'rulefile_classifications_audit_types_actions_column'
        );
        expect(actions_header?.querySelector('.visually-hidden')).toBeNull();
        expect(actions_header?.getAttribute('scope')).toBe('col');
        expect(container.querySelectorAll('.audit-types-table thead th').length).toBe(3);

        const edit_button = container.querySelector('.audit-types-row-edit-button') as HTMLButtonElement;
        expect(edit_button).not.toBeNull();
        edit_button.click();

        const dialog = document.querySelector('.audit-type-edit-dialog') as HTMLDialogElement;
        expect(dialog).not.toBeNull();
        expect(dialog.hasAttribute('open')).toBe(true);
        await flush_animation_frames();
        expect(dialog.classList.contains('modal-dialog--visible')).toBe(true);
        expect(dialog.querySelector('input[type="text"]')).not.toBeNull();
        expect(dialog.querySelector('select')).not.toBeNull();
    });

    test('Stängning av modal återför fokus till Redigera-knappen', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        render_audit_types_editor(ctx, container, { ...sample_metadata });

        const edit_button = container.querySelector('.audit-types-row-edit-button') as HTMLButtonElement;
        edit_button.click();

        const close_button = document.querySelector(
            '.audit-type-edit-dialog button[type="button"]'
        ) as HTMLButtonElement;
        close_button.click();

        expect(document.querySelector('.audit-type-edit-dialog')).toBeNull();
        expect(document.activeElement).toBe(edit_button);
    });

    test('Tabellen visar granskningstyp och taxonomi', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        render_audit_types_editor(ctx, container, { ...sample_metadata });

        const row_header = container.querySelector('.audit-types-row-header');
        expect(row_header?.textContent).toContain(DEFAULT_AUDIT_TYPES[0].label);
        expect(container.querySelector('.audit-types-taxonomy-cell')).not.toBeNull();
        expect(container.querySelector('.audit-types-row-delete-button')).not.toBeNull();
    });

    test('Filter visas när tabellen har minst tre rader', () => {
        const ctx = {
            Helpers: create_helpers(),
            Translation: { t: (key: string) => key },
        };
        render_audit_types_editor(ctx, container, { ...sample_metadata });
        expect(container.querySelector('.rulefile-classifications-table-filter')).toBeNull();

        container.innerHTML = '';
        render_audit_types_editor(ctx, container, {
            ...sample_metadata,
            auditTypes: [
                ...DEFAULT_AUDIT_TYPES.map((row) => ({ ...row })),
                { id: 'extra-type', label: 'Extra typ', taxonomyId: 'wcag22-pour' },
            ],
        });
        expect(container.querySelector('.rulefile-classifications-table-filter')).not.toBeNull();
        expect(container.querySelector('.rulefile-classifications-table-filter label')?.textContent).toBe(
            'rulefile_classifications_audit_types_filter_label'
        );
    });
});
