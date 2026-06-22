/**
 * @fileoverview Filista i modalen Bifoga media.
 */

import { create_attach_media_filename_list_item } from './render_audit_media_list_item.js';
import { focus_after_removed_item } from './attach_media_modal_list_focus.js';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
};

function build_filename_list(
    helpers: HelpersLike,
    t: TranslateFn,
    audit_id: string | null | undefined,
    filenames: string[],
    on_remove: (name: string, removed_index: number, trigger: HTMLButtonElement) => void,
    on_image_click?: (filename: string, trigger: HTMLButtonElement) => void,
    resolve_fetch_filename?: (filename: string) => string
): HTMLElement {
    const list = helpers.create_element('ul', { class_name: 'attach-media-filename-list' });
    if (filenames.length === 0) {
        list.appendChild(
            helpers.create_element('li', {
                class_name: 'attach-media-filename-list__empty',
                text_content: t('attach_media_list_empty')
            })
        );
        return list;
    }

    filenames.forEach((name, index) => {
        list.appendChild(
            create_attach_media_filename_list_item(
                helpers,
                t,
                audit_id,
                name,
                (trigger) => on_remove(name, index, trigger),
                on_image_click,
                resolve_fetch_filename
            )
        );
    });
    return list;
}

export function refresh_filename_list_container(
    container: HTMLElement,
    helpers: HelpersLike,
    t: TranslateFn,
    audit_id: string | null | undefined,
    filenames: string[],
    on_remove: (name: string, removed_index: number, trigger: HTMLButtonElement) => void,
    on_image_click?: (filename: string, trigger: HTMLButtonElement) => void,
    focus_after_remove?: { removed_index: number; modal_container: HTMLElement },
    resolve_fetch_filename?: (filename: string) => string
): void {
    container.replaceChildren(
        build_filename_list(
            helpers,
            t,
            audit_id,
            filenames,
            on_remove,
            on_image_click,
            resolve_fetch_filename
        )
    );
    if (focus_after_remove) {
        focus_after_removed_item(
            container,
            focus_after_remove.modal_container,
            focus_after_remove.removed_index
        );
    }
}
