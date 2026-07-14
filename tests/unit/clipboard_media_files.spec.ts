/**
 * @fileoverview Enhetstester för urklipps-hjälpfunktioner för media.
 */

import { describe, test, expect, jest, afterEach } from '@jest/globals';
import {
    build_clipboard_paste_filename,
    can_use_navigator_clipboard_read,
    clipboard_event_has_non_file_content,
    clipboard_event_has_non_image_files,
    ensure_paste_filename,
    extract_image_files_from_clipboard_event,
    extract_image_files_from_navigator_clipboard,
    should_handle_paste_event
} from '../../shared/media/clipboard_media_files.js';

function create_mock_file(name: string, type: string, size = 10): File {
    return new File([new Uint8Array(size)], name, { type });
}

function create_clipboard_event(items: Array<{ kind: string; type: string; file?: File | null }>): ClipboardEvent {
    const data_transfer_items = items.map((entry) => ({
        kind: entry.kind,
        type: entry.type,
        getAsFile: () => entry.file ?? null
    }));
    return {
        clipboardData: {
            items: data_transfer_items
        },
        target: document.body,
        preventDefault: jest.fn()
    } as unknown as ClipboardEvent;
}

describe('clipboard_media_files', () => {
    test('build_clipboard_paste_filename använder tidsstämpel och rätt ändelse', () => {
        const filename = build_clipboard_paste_filename('image/jpeg', '2026-07-14T10:30:45.000Z');
        expect(filename).toMatch(/^urklipp_\d{8}_\d{6}\.jpg$/);
    });

    test('ensure_paste_filename ersätter generiska namn', () => {
        const generic = create_mock_file('image.png', 'image/png');
        const renamed = ensure_paste_filename(generic);
        expect(renamed.name).toMatch(/^urklipp_\d{8}_\d{6}\.png$/);
        expect(renamed.type).toBe('image/png');
    });

    test('ensure_paste_filename behåller riktiga filnamn', () => {
        const original = create_mock_file('skarmavbild.png', 'image/png');
        const kept = ensure_paste_filename(original);
        expect(kept.name).toBe('skarmavbild.png');
    });

    test('extract_image_files_from_clipboard_event plockar ut bilder', () => {
        const png = create_mock_file('image.png', 'image/png');
        const pdf = create_mock_file('rapport.pdf', 'application/pdf');
        const event = create_clipboard_event([
            { kind: 'file', type: 'image/png', file: png },
            { kind: 'file', type: 'application/pdf', file: pdf }
        ]);

        const files = extract_image_files_from_clipboard_event(event);
        expect(files).toHaveLength(1);
        expect(files[0]?.name).toMatch(/^urklipp_\d{8}_\d{6}\.png$/);
    });

    test('clipboard_event_has_non_image_files identifierar ogiltiga filer', () => {
        const event = create_clipboard_event([
            { kind: 'file', type: 'application/pdf', file: create_mock_file('rapport.pdf', 'application/pdf') }
        ]);
        expect(clipboard_event_has_non_image_files(event)).toBe(true);
    });

    test('clipboard_event_has_non_file_content hittar text i urklipp', () => {
        const event = create_clipboard_event([{ kind: 'string', type: 'text/plain' }]);
        expect(clipboard_event_has_non_file_content(event)).toBe(true);
    });

    test('should_handle_paste_event hoppar över textarea och textfält', () => {
        const textarea = document.createElement('textarea');
        const input = document.createElement('input');
        input.type = 'text';
        expect(should_handle_paste_event(textarea)).toBe(false);
        expect(should_handle_paste_event(input)).toBe(false);
        expect(should_handle_paste_event(document.body)).toBe(true);
    });

    test('extract_image_files_from_navigator_clipboard konverterar ClipboardItem till File', async () => {
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
        const items = [
            {
                types: ['image/png'],
                getType: async (type: string) => {
                    if (type === 'image/png') return blob;
                    throw new Error('unexpected type');
                }
            }
        ] as unknown as ClipboardItem[];

        const files = await extract_image_files_from_navigator_clipboard(items);
        expect(files).toHaveLength(1);
        expect(files[0]?.type).toBe('image/png');
        expect(files[0]?.name).toMatch(/^urklipp_\d{8}_\d{6}\.png$/);
    });

    describe('can_use_navigator_clipboard_read', () => {
        const original_is_secure = window.isSecureContext;
        const original_clipboard = navigator.clipboard;

        afterEach(() => {
            Object.defineProperty(window, 'isSecureContext', {
                configurable: true,
                value: original_is_secure
            });
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: original_clipboard
            });
        });

        test('returnerar true när API finns i säker kontext', () => {
            Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { read: jest.fn() }
            });
            expect(can_use_navigator_clipboard_read()).toBe(true);
        });

        test('returnerar false utanför säker kontext', () => {
            Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { read: jest.fn() }
            });
            expect(can_use_navigator_clipboard_read()).toBe(false);
        });
    });
});
