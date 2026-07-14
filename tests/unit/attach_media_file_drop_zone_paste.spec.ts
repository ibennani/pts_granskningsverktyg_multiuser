/**
 * @fileoverview Integrationstester för urklipps-klistring i media-drop-zon.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { create_attach_media_file_drop_zone } from '../../js/components/media/attach_media_file_drop_zone.js';

const t = (key: string) => key;

const helpers = {
    create_element: (tag: string, opts: Record<string, unknown> = {}) => {
        const el = document.createElement(tag);
        if (opts.class_name) {
            const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];
            el.className = classes.join(' ');
        }
        if (typeof opts.text_content === 'string') {
            el.textContent = opts.text_content;
        }
        if (typeof opts.html_content === 'string') {
            el.innerHTML = opts.html_content;
        }
        if (opts.attributes && typeof opts.attributes === 'object') {
            for (const [name, value] of Object.entries(opts.attributes as Record<string, string>)) {
                el.setAttribute(name, value);
            }
        }
        if (opts.id) {
            el.id = String(opts.id);
        }
        return el;
    },
    get_icon_svg: () => ''
};

function create_mock_file(name: string, type: string): File {
    return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function dispatch_paste(target: HTMLElement, items: Array<{ kind: string; type: string; file?: File | null }>) {
    const data_transfer_items = items.map((entry) => ({
        kind: entry.kind,
        type: entry.type,
        getAsFile: () => entry.file ?? null
    }));
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', {
        value: { items: data_transfer_items }
    });
    Object.defineProperty(event, 'target', { value: target, configurable: true });
    target.dispatchEvent(event);
    return event;
}

describe('attach_media_file_drop_zone paste', () => {
    let root: HTMLElement;
    const original_is_secure = window.isSecureContext;
    const original_clipboard = navigator.clipboard;

    beforeEach(() => {
        root = document.createElement('div');
        document.body.appendChild(root);
        Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { read: jest.fn() }
        });
    });

    afterEach(() => {
        root.remove();
        Object.defineProperty(window, 'isSecureContext', {
            configurable: true,
            value: original_is_secure
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: original_clipboard
        });
    });

    test('klistrar in video via paste-event och anropar on_files', () => {
        const on_files = jest.fn();
        const zone = create_attach_media_file_drop_zone({
            helpers,
            t,
            input_id: 'media-input-video',
            label_id: 'media-label-video',
            label_key: 'attach_media_choose_file_label',
            on_files
        });
        root.appendChild(zone.group);

        const mp4 = create_mock_file('video.mp4', 'video/mp4');
        const event = dispatch_paste(zone.group, [{ kind: 'file', type: 'video/mp4', file: mp4 }]);
        expect(event.defaultPrevented).toBe(true);
        expect(on_files).toHaveBeenCalledTimes(1);
        expect(on_files.mock.calls[0]?.[0]?.[0]?.type).toBe('video/mp4');
        zone.destroy();
    });

    test('klistrar in bild via paste-event och anropar on_files', () => {
        const on_files = jest.fn();
        const zone = create_attach_media_file_drop_zone({
            helpers,
            t,
            input_id: 'media-input',
            label_id: 'media-label',
            label_key: 'attach_media_choose_file_label',
            on_files
        });
        root.appendChild(zone.group);

        const png = create_mock_file('image.png', 'image/png');
        const event = dispatch_paste(zone.group, [{ kind: 'file', type: 'image/png', file: png }]);
        expect(event.defaultPrevented).toBe(true);
        expect(on_files).toHaveBeenCalledTimes(1);
        expect(on_files.mock.calls[0]?.[0]?.[0]?.name).toMatch(/^urklipp_\d{8}_\d{6}\.png$/);
        zone.destroy();
    });

    test('ignorerar paste när fokus ligger i textarea', () => {
        const on_files = jest.fn();
        const zone = create_attach_media_file_drop_zone({
            helpers,
            t,
            input_id: 'media-input-2',
            label_id: 'media-label-2',
            label_key: 'attach_media_choose_file_label',
            on_files
        });
        root.appendChild(zone.group);

        const textarea = document.createElement('textarea');
        zone.group.appendChild(textarea);
        const png = create_mock_file('image.png', 'image/png');
        const event = dispatch_paste(textarea, [{ kind: 'file', type: 'image/png', file: png }]);
        expect(event.defaultPrevented).toBe(false);
        expect(on_files).not.toHaveBeenCalled();
        zone.destroy();
    });

    test('visar felmeddelande när urklipp bara innehåller text', () => {
        const on_status = jest.fn();
        const zone = create_attach_media_file_drop_zone({
            helpers,
            t,
            input_id: 'media-input-3',
            label_id: 'media-label-3',
            label_key: 'attach_media_choose_file_label',
            on_files: jest.fn(),
            on_status
        });
        root.appendChild(zone.group);

        dispatch_paste(zone.group, [{ kind: 'string', type: 'text/plain' }]);
        expect(on_status).toHaveBeenCalledWith('attach_media_paste_no_media', 'error');
        zone.destroy();
    });

    test('renderar knappen Klistra in när Clipboard API finns', () => {
        const zone = create_attach_media_file_drop_zone({
            helpers,
            t,
            input_id: 'media-input-4',
            label_id: 'media-label-4',
            label_key: 'attach_media_choose_file_label',
            on_files: jest.fn()
        });
        root.appendChild(zone.group);

        const paste_btn = zone.group.querySelector('.attach-media-paste-btn');
        expect(paste_btn).not.toBeNull();
        expect(paste_btn?.textContent).toBe('attach_media_paste_button');
        zone.destroy();
    });

    test('klistrar in via knapp och navigator.clipboard.read', async () => {
        const on_files = jest.fn();
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
        const read_mock = jest.fn(async () => [
            {
                types: ['image/png'],
                getType: async (type: string) => {
                    if (type === 'image/png') return blob;
                    throw new Error('unexpected type');
                }
            }
        ]);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { read: read_mock }
        });

        const zone = create_attach_media_file_drop_zone({
            helpers,
            t,
            input_id: 'media-input-5',
            label_id: 'media-label-5',
            label_key: 'attach_media_choose_file_label',
            on_files
        });
        root.appendChild(zone.group);

        const paste_btn = zone.group.querySelector('.attach-media-paste-btn') as HTMLButtonElement;
        paste_btn.click();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(read_mock).toHaveBeenCalled();
        expect(on_files).toHaveBeenCalledTimes(1);
        zone.destroy();
    });
});
