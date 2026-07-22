/**
 * @fileoverview Regressionstester: modalen Bifoga media ska kunna byggas utan runtime-fel.
 */

import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { setup_attach_media_modal_content } from '../../js/components/media/attach_media_modal_setup.ts';
import { ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS } from '../../shared/constants/modal_layout.ts';

function create_helpers() {
    return {
        create_element(tag: string, opts: Record<string, unknown> = {}) {
            const el = document.createElement(tag);
            if (opts.class_name) {
                const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];
                el.className = classes.map(String).join(' ');
            }
            if (opts.text_content) {
                el.textContent = String(opts.text_content);
            }
            if (opts.html_content && typeof opts.html_content === 'string') {
                el.innerHTML = opts.html_content;
            }
            if (opts.attributes && typeof opts.attributes === 'object') {
                Object.entries(opts.attributes as Record<string, string>).forEach(([key, value]) => {
                    el.setAttribute(key, String(value));
                });
            }
            if (opts.id) {
                el.id = String(opts.id);
            }
            return el;
        },
        escape_html(value: string) {
            return value;
        },
        get_icon_svg() {
            return '';
        },
        init_auto_resize_for_textarea() {}
    };
}

function setup_modal_dom() {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal-dialog';
    const shell = document.createElement('div');
    shell.className = 'modal-content';
    const header = document.createElement('div');
    header.className = 'modal-header';
    const heading = document.createElement('h1');
    heading.id = 'modal-dialog-title';
    const message = document.createElement('p');
    message.className = 'modal-message';
    message.textContent = 'Intro';
    header.append(heading, message);
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.id = 'modal-content-container';
    shell.append(header, body);
    dialog.appendChild(shell);
    document.body.appendChild(dialog);
    return { dialog, container: body, shell, header };
}

describe('setup_attach_media_modal_content', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404
        }) as unknown as typeof fetch;
        window.matchMedia = jest.fn().mockImplementation(() => ({
            matches: false,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        }));
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('bygger listvy utan att kasta fel (krav-bifogning, online)', () => {
        const { dialog, container, shell } = setup_modal_dom();
        const t = (key: string) => key;

        expect(() => {
            setup_attach_media_modal_content(container, {
                close: () => {},
                dialog_element_ref: dialog,
                shell_container_ref: shell
            }, {
                t,
                Helpers: create_helpers(),
                audit_id: 'audit-test-1',
                initial_filenames: ['bild.png'],
                textarea_id: 'attach-media-filenames-images-view',
                media_scope: 'requirement',
                on_save: () => {},
                can_upload: true,
                working_filenames: ['bild.png'],
                persisted_filenames: new Set(['bild.png']),
                persist_in_flight: false
            });
        }).not.toThrow();

        expect(container.querySelector('.attach-media-list-mode')).not.toBeNull();
        expect(container.querySelector('.modal-attach-media-actions')).not.toBeNull();
        expect(container.querySelector('.attach-media-filename-list')).not.toBeNull();
    });

    it('döljer Spara och Stäng utan att spara vid filnamnsbyte', async () => {
        const { dialog, container, shell, header } = setup_modal_dom();
        const heading = header.querySelector('#modal-dialog-title') as HTMLHeadingElement;
        const t = (key: string) => key;

        setup_attach_media_modal_content(container, {
            close: () => {},
            dialog_element_ref: dialog,
            shell_container_ref: shell,
            header_container_ref: header
        }, {
            t,
            Helpers: create_helpers(),
            audit_id: 'audit-test-1',
            initial_filenames: ['bild.png'],
            textarea_id: 'attach-media-filenames-images-view',
            media_scope: 'requirement',
            on_save: () => {},
            can_upload: true,
            working_filenames: ['bild.png'],
            persisted_filenames: new Set(['bild.png']),
            persist_in_flight: false
        });

        const actions_wrapper = container.querySelector('.modal-attach-media-actions') as HTMLElement;
        const rename_btn = Array.from(
            container.querySelectorAll('.attach-media-filename-list__actions button')
        ).find((button) => button.textContent === 'attach_media_rename_file_short') as HTMLButtonElement;
        expect(actions_wrapper).not.toBeNull();
        expect(rename_btn).not.toBeNull();

        rename_btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);

        expect(document.activeElement).toBe(heading);
        expect(actions_wrapper.hasAttribute('hidden')).toBe(true);
        expect(container.querySelector('.attach-media-rename-panel')).not.toBeNull();
        expect(container.querySelector('.attach-media-rename-panel__intro')).not.toBeNull();
        expect(heading.textContent).toBe('attach_media_rename_panel_heading');

        const visible_modal_actions = container.querySelectorAll(
            '.modal-attach-media-actions:not([hidden]) button'
        );
        expect(visible_modal_actions.length).toBe(0);

        const rename_actions = container.querySelectorAll(
            '.attach-media-rename-panel__actions button'
        );
        expect(rename_actions.length).toBe(2);
    });
});
