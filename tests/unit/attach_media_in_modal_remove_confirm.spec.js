/**
 * @fileoverview Enhetstester för borttagningsbekräftelse i modalen Bifoga media.
 */

import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { create_attach_media_in_modal_remove_confirm } from '../../js/components/media/attach_media_in_modal_remove_confirm.ts';
import { MODAL_TRANSITION_MS } from '../../shared/constants/modal_layout.ts';

function create_helpers() {
    return {
        create_element(tag, opts = {}) {
            const el = document.createElement(tag);
            if (opts.class_name) {
                const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];
                el.className = classes.join(' ');
            }
            if (opts.text_content) el.textContent = opts.text_content;
            if (opts.attributes) {
                Object.entries(opts.attributes).forEach(([key, value]) => {
                    el.setAttribute(key, String(value));
                });
            }
            return el;
        }
    };
}

function setup_modal_dom() {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal-dialog';
    const shell = document.createElement('div');
    shell.className = 'modal-content modal-content--attach-media';
    const header = document.createElement('div');
    header.className = 'modal-header';
    const heading = document.createElement('h1');
    heading.id = 'modal-dialog-title';
    const message = document.createElement('p');
    message.className = 'modal-message';
    header.append(heading, message);
    const body = document.createElement('div');
    body.className = 'modal-body modal-body--attach-media';
    const list_root = document.createElement('div');
    list_root.className = 'attach-media-list-mode';
    list_root.textContent = 'list';
    body.appendChild(list_root);
    shell.append(header, body);
    dialog.appendChild(shell);
    document.body.appendChild(dialog);
    return { dialog, container: body, shell, heading, message, list_root };
}

describe('create_attach_media_in_modal_remove_confirm', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
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

    it('visar bekräftelsevy med rubrik och knappar vid borttagning', async () => {
        const { container, heading, message, list_root } = setup_modal_dom();
        const on_prepare_confirm_remove = jest.fn(() => null);
        const t = (key, params) => {
            if (key === 'attach_media_remove_confirm_message') return `Ta bort ${params.filename}`;
            return key;
        };

        const controller = create_attach_media_in_modal_remove_confirm({
            t,
            Helpers: create_helpers(),
            modal_container: container,
            heading_el: heading,
            message_el: message,
            list_mode_root: list_root,
            modal_heading_text: 'Bifoga media',
            modal_message_text: 'Intro',
            on_prepare_confirm_remove
        });

        const trigger = document.createElement('button');
        trigger.type = 'button';
        document.body.appendChild(trigger);

        controller.open_remove_confirm('test.jpeg', 0, trigger);
        await jest.advanceTimersByTimeAsync(MODAL_TRANSITION_MS + 100);

        expect(controller.is_remove_confirm_open()).toBe(true);
        expect(heading.textContent).toBe('attach_media_remove_confirm_h1');
        expect(message.textContent).toBe('Ta bort test.jpeg');
        expect(list_root.isConnected).toBe(false);
        expect(container.querySelector('.attach-media-remove-confirm-actions')).not.toBeNull();
    });

    it('förbereder borttagning före återgång och fokuserar efter animation', async () => {
        const { container, heading, message, list_root } = setup_modal_dom();
        const focus_target = document.createElement('button');
        focus_target.type = 'button';
        document.body.appendChild(focus_target);
        const on_prepare_confirm_remove = jest.fn(() => focus_target);
        const on_after_confirm_remove = jest.fn();
        const t = (key) => key;

        const controller = create_attach_media_in_modal_remove_confirm({
            t,
            Helpers: create_helpers(),
            modal_container: container,
            heading_el: heading,
            message_el: message,
            list_mode_root: list_root,
            modal_heading_text: 'Bifoga media',
            modal_message_text: 'Intro',
            on_prepare_confirm_remove,
            on_after_confirm_remove
        });

        const trigger = document.createElement('button');
        trigger.type = 'button';
        document.body.appendChild(trigger);

        controller.open_remove_confirm('a.jpeg', 1, trigger);
        await jest.advanceTimersByTimeAsync(MODAL_TRANSITION_MS + 100);

        const confirm_btn = container.querySelector(
            '.attach-media-remove-confirm-actions .button-danger'
        );
        confirm_btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await jest.advanceTimersByTimeAsync(MODAL_TRANSITION_MS + 100);

        expect(on_prepare_confirm_remove).toHaveBeenCalledWith('a.jpeg', 1);
        expect(on_after_confirm_remove).toHaveBeenCalledWith('a.jpeg');
        expect(controller.is_remove_confirm_open()).toBe(false);
        expect(list_root.isConnected).toBe(true);
        expect(heading.textContent).toBe('Bifoga media');
        expect(document.activeElement).toBe(focus_target);
    });

    it('återgår till samma radera-knapp vid behåll', async () => {
        const { container, heading, message, list_root } = setup_modal_dom();
        const on_prepare_confirm_remove = jest.fn();
        const t = (key) => key;

        const controller = create_attach_media_in_modal_remove_confirm({
            t,
            Helpers: create_helpers(),
            modal_container: container,
            heading_el: heading,
            message_el: message,
            list_mode_root: list_root,
            modal_heading_text: 'Bifoga media',
            modal_message_text: 'Intro',
            on_prepare_confirm_remove
        });

        const trigger = document.createElement('button');
        trigger.type = 'button';
        document.body.appendChild(trigger);

        controller.open_remove_confirm('b.jpeg', 0, trigger);
        await jest.advanceTimersByTimeAsync(MODAL_TRANSITION_MS + 100);

        const keep_btn = container.querySelector(
            '.attach-media-remove-confirm-actions .button-default'
        );
        keep_btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await jest.advanceTimersByTimeAsync(MODAL_TRANSITION_MS + 100);

        expect(on_prepare_confirm_remove).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(trigger);
    });
});
