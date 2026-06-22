/**
 * @fileoverview Regressionstester: modalen Bifoga media ska kunna byggas utan runtime-fel.
 */

import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { setup_attach_media_modal_content } from '../../js/components/media/attach_media_modal_setup.ts';

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
    const container = document.createElement('div');
    container.className = 'modal-content';
    const heading = document.createElement('h1');
    heading.id = 'modal-dialog-title';
    const message = document.createElement('p');
    message.className = 'modal-message';
    message.textContent = 'Intro';
    container.append(heading, message);
    dialog.appendChild(container);
    document.body.appendChild(dialog);
    return { dialog, container };
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
    });

    it('bygger listvy utan att kasta fel (krav-bifogning, online)', () => {
        const { dialog, container } = setup_modal_dom();
        const t = (key: string) => key;

        expect(() => {
            setup_attach_media_modal_content(container, {
                close: () => {},
                dialog_element_ref: dialog
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
});
