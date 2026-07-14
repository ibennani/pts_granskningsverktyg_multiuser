/**
 * @fileoverview Tester för dra/släpp och klistra in i Word-importfilzonen.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { create_observation_word_file_drop_zone } from '../../js/components/observation_word_import/observation_word_file_drop_zone.ts';

const t = (key: string) => key;

const helpers = {
    create_element: (tag: string, opts: Record<string, unknown> = {}) => {
        const el = document.createElement(tag);
        if (opts.class_name) {
            const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];
            el.className = classes.map(String).join(' ');
        }
        if (typeof opts.text_content === 'string') {
            el.textContent = opts.text_content;
        }
        if (typeof opts.html_content === 'string') {
            el.innerHTML = opts.html_content;
        }
        if (opts.attributes && typeof opts.attributes === 'object') {
            for (const [name, value] of Object.entries(opts.attributes as Record<string, string>)) {
                el.setAttribute(name, String(value));
            }
        }
        return el;
    },
    get_icon_svg: () => '',
};

function create_docx_file(name = 'handling.docx'): File {
    return new File([new Uint8Array([1, 2, 3])], name, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
}

function dispatch_paste(target: HTMLElement, items: Array<{ kind: string; type: string; file?: File | null }>) {
    const data_transfer_items = items.map((entry) => ({
        kind: entry.kind,
        type: entry.type,
        getAsFile: () => entry.file ?? null,
    }));
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
        value: { items: data_transfer_items },
    });
    Object.defineProperty(event, 'target', { value: target, configurable: true });
    target.dispatchEvent(event);
    return event;
}

function dispatch_drop(target: HTMLElement, files: File[]) {
    const data_transfer = {
        types: ['Files'],
        files,
        items: files.map((file) => ({
            kind: 'file',
            type: file.type,
            getAsFile: () => file,
        })),
        dropEffect: 'none',
    };
    const drag_over = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(drag_over, 'dataTransfer', { value: data_transfer });
    target.dispatchEvent(drag_over);

    const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(drop, 'dataTransfer', { value: data_transfer });
    target.dispatchEvent(drop);
    return drop;
}

describe('observation_word_file_drop_zone', () => {
    let root: HTMLElement;
    const original_is_secure = window.isSecureContext;
    const original_clipboard = navigator.clipboard;

    beforeEach(() => {
        root = document.createElement('div');
        document.body.appendChild(root);
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { read: jest.fn() },
        });
    });

    afterEach(() => {
        root.remove();
        Object.defineProperty(window, 'isSecureContext', {
            configurable: true,
            value: original_is_secure,
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: original_clipboard,
        });
    });

    test('tar emot Word-fil via drop på modalcontainer', () => {
        const on_file = jest.fn();
        const modal_container = document.createElement('div');
        root.appendChild(modal_container);

        const zone = create_observation_word_file_drop_zone({
            helpers,
            t,
            input_id: 'word-input-drop',
            on_file,
            additional_drop_targets: [modal_container],
        });
        root.appendChild(zone.group);

        const docx = create_docx_file();
        dispatch_drop(modal_container, [docx]);

        expect(on_file).toHaveBeenCalledTimes(1);
        expect(on_file.mock.calls[0]?.[0]?.name).toBe('handling.docx');
        zone.destroy();
    });

    test('klistrar in Word-fil via paste på modalcontainer', () => {
        const on_file = jest.fn();
        const modal_container = document.createElement('div');
        root.appendChild(modal_container);

        const zone = create_observation_word_file_drop_zone({
            helpers,
            t,
            input_id: 'word-input-paste',
            on_file,
            additional_drop_targets: [modal_container],
            paste_modal_root: modal_container,
        });
        root.appendChild(zone.group);

        const docx = create_docx_file('klistrad.docx');
        const event = dispatch_paste(modal_container, [{
            kind: 'file',
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            file: docx,
        }]);
        expect(event.defaultPrevented).toBe(true);
        expect(on_file).toHaveBeenCalledTimes(1);
        zone.destroy();
    });

    test('renderar knappen Klistra in när Clipboard API finns', () => {
        const zone = create_observation_word_file_drop_zone({
            helpers,
            t,
            input_id: 'word-input-btn',
            on_file: jest.fn(),
        });
        root.appendChild(zone.group);

        const paste_btn = zone.group.querySelector('.observation-word-import-paste-btn');
        expect(paste_btn).not.toBeNull();
        expect(paste_btn?.textContent).toBe('observation_word_import_paste_button');
        zone.destroy();
    });
});
