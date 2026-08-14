/**
 * @fileoverview Enhetstester för inline-panelen vid omdöpning av mediefiler.
 */

import { app_session_storage } from '../helpers/scoped_session_storage.ts';
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS } from '../../shared/constants/modal_layout.ts';
import { create_attach_media_modal_rename_panel } from '../../js/components/media/attach_media_modal_rename_panel.ts';
import { create_audit_media_server_index } from '../../js/logic/audit_media_server_index.ts';
import type { AuditMediaServerIndex } from '../../js/logic/audit_media_server_index.js';

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
            if (opts.attributes && typeof opts.attributes === 'object') {
                Object.entries(opts.attributes as Record<string, string>).forEach(([key, value]) => {
                    el.setAttribute(key, String(value));
                });
            }
            return el;
        },
        escape_html(value: string) {
            return value;
        }
    };
}

function setup_panel_dom() {
    const modal_container = document.createElement('div');
    modal_container.className = 'modal-body';
    const list_mode_root = document.createElement('div');
    list_mode_root.className = 'attach-media-list-mode';
    modal_container.appendChild(list_mode_root);
    const heading = document.createElement('h1');
    heading.id = 'modal-dialog-title';
    const message = document.createElement('p');
    message.className = 'modal-message';
    message.textContent = 'Intro';
    document.body.append(modal_container, heading, message);
    return { modal_container, list_mode_root, heading, message };
}

function mock_list_response() {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            files: [{ filename: 'cookiebanner_oversikt.png', size: 1, mime: 'image/png' }],
            filenameMigrations: []
        })
    };
}

describe('create_attach_media_modal_rename_panel', () => {
    let server_index: AuditMediaServerIndex;
    let working_filenames: string[];
    let set_working_filenames: jest.Mock;
    let refresh_list: jest.Mock;
    let persist_media_changes: jest.Mock;
    let show_status: jest.Mock;
    let clear_status: jest.Mock;
    let fetch_mock: jest.Mock;

    beforeEach(() => {
        document.body.innerHTML = '';
        sessionStorage.clear();
        app_session_storage.setItem('auth_token', 'test-token');
        working_filenames = ['cookie-banner_oversikt.png'];
        set_working_filenames = jest.fn((names: string[]) => {
            working_filenames = names;
        });
        refresh_list = jest.fn();
        persist_media_changes = jest.fn().mockResolvedValue(true);
        show_status = jest.fn();
        clear_status = jest.fn();
        fetch_mock = jest.fn();
        global.fetch = fetch_mock as unknown as typeof fetch;
        server_index = create_audit_media_server_index('audit-rename-1');
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

    function create_panel() {
        const { modal_container, list_mode_root, heading, message } = setup_panel_dom();
        const panel = create_attach_media_modal_rename_panel({
            t: (key: string) => key,
            Helpers: create_helpers(),
            audit_id: 'audit-rename-1',
            modal_container,
            heading_el: heading,
            modal_heading_text: 'Bifoga media',
            message_el: message,
            modal_message_text: 'Intro',
            list_mode_root,
            get_elements_to_hide: () => [],
            get_working_filenames: () => working_filenames,
            set_working_filenames,
            server_index,
            persist_media_changes,
            show_status,
            clear_status,
            refresh_list,
            on_open_change: () => {}
        });
        return { panel, heading, modal_container };
    }

    it('visar serverfilnamn i fältet när listnamnet skiljer sig', async () => {
        fetch_mock.mockResolvedValue(mock_list_response());
        const { panel } = create_panel();
        const trigger = document.createElement('button') as HTMLButtonElement;
        document.body.appendChild(trigger);

        panel.open_rename_panel('cookie-banner_oversikt.png', trigger);
        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);

        const input = document.querySelector('.attach-media-rename-panel input') as HTMLInputElement;
        expect(input).not.toBeNull();
        expect(input.value).toBe('cookiebanner_oversikt.png');
        expect(clear_status).toHaveBeenCalled();
    });

    it('döper om från serverfilnamn och lägger till .png vid spara', async () => {
        fetch_mock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (String(url).includes('/media/rename')) {
                expect(init?.method).toBe('POST');
                const body = JSON.parse(String(init?.body));
                expect(body).toEqual({
                    fromFilename: 'cookiebanner_oversikt.png',
                    newFilename: 'cookiebanner_ny.png'
                });
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ filename: 'cookiebanner_ny.png' })
                };
            }
            return mock_list_response();
        });

        const { panel } = create_panel();
        const trigger = document.createElement('button') as HTMLButtonElement;
        document.body.appendChild(trigger);

        panel.open_rename_panel('cookie-banner_oversikt.png', trigger);
        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);

        const input = document.querySelector('.attach-media-rename-panel input') as HTMLInputElement;
        input.value = 'cookiebanner_ny';

        const save_btn = document.querySelector(
            '.attach-media-rename-panel__actions .button-primary'
        ) as HTMLButtonElement;
        save_btn.click();
        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);
        await Promise.resolve();
        await Promise.resolve();

        expect(set_working_filenames).toHaveBeenCalledWith(['cookiebanner_ny.png']);
        expect(refresh_list).toHaveBeenCalled();
        expect(persist_media_changes).toHaveBeenCalledWith(false);
    });

    it('använder PATCH-reserv när POST /media/rename saknas på servern', async () => {
        fetch_mock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (String(url).includes('/media/rename')) {
                return {
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    headers: { get: () => 'text/html' },
                    text: async () => '<html>Not Found</html>'
                };
            }
            if (String(url).includes('/media/cookiebanner_oversikt.png') && init?.method === 'PATCH') {
                const body = JSON.parse(String(init?.body));
                expect(body).toEqual({ newFilename: 'cookiebanner_ny.png' });
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ filename: 'cookiebanner_ny.png' })
                };
            }
            return mock_list_response();
        });

        const { panel } = create_panel();
        const trigger = document.createElement('button') as HTMLButtonElement;
        document.body.appendChild(trigger);

        panel.open_rename_panel('cookie-banner_oversikt.png', trigger);
        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);

        const input = document.querySelector('.attach-media-rename-panel input') as HTMLInputElement;
        input.value = 'cookiebanner_ny';

        const save_btn = document.querySelector(
            '.attach-media-rename-panel__actions .button-primary'
        ) as HTMLButtonElement;
        save_btn.click();
        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);
        await Promise.resolve();
        await Promise.resolve();

        expect(set_working_filenames).toHaveBeenCalledWith(['cookiebanner_ny.png']);
        expect(show_status).not.toHaveBeenCalledWith('attach_media_rename_not_on_server', 'error');
    });

    it('döper om video utan att lägga till .png', async () => {
        fetch_mock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (String(url).includes('/media/rename')) {
                const body = JSON.parse(String(init?.body));
                expect(body).toEqual({
                    fromFilename: 'demo.mp4',
                    newFilename: 'nytt.mp4'
                });
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ filename: 'nytt.mp4' })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    files: [{ filename: 'demo.mp4', size: 1, mime: 'video/mp4' }],
                    filenameMigrations: []
                })
            };
        });

        working_filenames = ['demo.mp4'];
        const { panel } = create_panel();
        const trigger = document.createElement('button') as HTMLButtonElement;
        document.body.appendChild(trigger);

        panel.open_rename_panel('demo.mp4', trigger);
        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);

        const input = document.querySelector('.attach-media-rename-panel input') as HTMLInputElement;
        input.value = 'nytt.mp4';

        const save_btn = document.querySelector(
            '.attach-media-rename-panel__actions .button-primary'
        ) as HTMLButtonElement;
        save_btn.click();
        await jest.advanceTimersByTimeAsync(ATTACH_MEDIA_INLINE_VIEW_TRANSITION_MS + 50);
        await Promise.resolve();
        await Promise.resolve();

        expect(set_working_filenames).toHaveBeenCalledWith(['nytt.mp4']);
    });
});
