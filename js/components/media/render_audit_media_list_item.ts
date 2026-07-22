/**
 * @fileoverview Renderar listposter för mediefiler i vyn Bifogad media (med miniatyr via blob).
 */

import { fetch_audit_media_blob_url } from '../../api/audit_media_api.js';
import {
    get_media_display_kind,
    is_previewable_image_filename
} from '../../../shared/media/sanitize_media_filename.js';
import { open_audit_media_image_preview } from './open_audit_media_image_preview.js';
import type { AuditMediaObservationEditOptions } from './audit_media_preview_observation.js';

type HelpersLike = {
    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
};

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

const blob_url_cache = new Map<string, string>();

function cache_key(audit_id: string, filename: string): string {
    return `${audit_id}::${filename}`;
}

function get_cached_blob_url(audit_id: string, filename: string): string | undefined {
    return blob_url_cache.get(cache_key(audit_id, filename));
}

/**
 * Returnerar cachad blob-URL för miniatyr om den finns.
 */
export function get_audit_media_cached_blob_url(
    audit_id: string,
    filename: string
): string | undefined {
    return get_cached_blob_url(audit_id, filename);
}

/**
 * Cachar en lokal blob-URL (t.ex. under pågående uppladdning) så miniatyr kan visas utan serveranrop.
 */
export function set_audit_media_local_preview_blob_url(
    audit_id: string,
    filename: string,
    blob_url: string
): void {
    const key = cache_key(audit_id, filename);
    const existing = blob_url_cache.get(key);
    if (existing && existing !== blob_url) {
        URL.revokeObjectURL(existing);
    }
    blob_url_cache.set(key, blob_url);
}

/**
 * Flyttar cachad blob-URL till nytt filnamn utan att ogiltigförklara URL:en (t.ex. efter server-omdöpning).
 */
export function move_audit_media_local_preview_blob_url(
    audit_id: string,
    from_filename: string,
    to_filename: string
): void {
    const from_key = cache_key(audit_id, from_filename);
    const to_key = cache_key(audit_id, to_filename);
    const blob_url = blob_url_cache.get(from_key);
    if (!blob_url) return;
    blob_url_cache.delete(from_key);
    set_audit_media_local_preview_blob_url(audit_id, to_filename, blob_url);
}

/**
 * Frigör blob-URL för en enskild mediefil (t.ex. efter borttagning).
 */
export function revoke_audit_media_blob_url(audit_id: string, filename: string): void {
    const key = cache_key(audit_id, filename);
    const url = blob_url_cache.get(key);
    if (!url) return;
    URL.revokeObjectURL(url);
    blob_url_cache.delete(key);
}

/**
 * Frigör blob-URL:er skapade för miniatyrer.
 */
export function revoke_audit_media_blob_urls(audit_id?: string | null): void {
    if (!audit_id) return;
    const prefix = `${audit_id}::`;
    for (const [key, url] of blob_url_cache.entries()) {
        if (key.startsWith(prefix)) {
            URL.revokeObjectURL(url);
            blob_url_cache.delete(key);
        }
    }
}

function load_audit_media_thumb_image(
    audit_id: string,
    filename: string,
    img: HTMLImageElement,
    host: HTMLElement,
    resolve_fetch_filename?: (filename: string) => string
): void {
    const ref_key = cache_key(audit_id, filename);
    const ref_cached = blob_url_cache.get(ref_key);
    if (ref_cached) {
        img.src = ref_cached;
        return;
    }

    const fetch_name = resolve_fetch_filename?.(filename) ?? filename;
    const fetch_key = cache_key(audit_id, fetch_name);
    const fetch_cached = blob_url_cache.get(fetch_key);
    if (fetch_cached) {
        img.src = fetch_cached;
        if (fetch_name !== filename) {
            blob_url_cache.set(ref_key, fetch_cached);
        }
        return;
    }

    void fetch_audit_media_blob_url(audit_id, fetch_name).then((blob_url) => {
        if (!blob_url || !host.isConnected) return;
        blob_url_cache.set(fetch_key, blob_url);
        if (fetch_name !== filename) {
            blob_url_cache.set(ref_key, blob_url);
        }
        img.src = blob_url;
    });
}

function create_static_image_thumb(
    helpers: HelpersLike,
    audit_id: string,
    filename: string,
    host: HTMLElement,
    resolve_fetch_filename?: (filename: string) => string
): HTMLImageElement {
    const img = helpers.create_element('img', {
        class_name: ['audit-image-card__media-thumb', 'attach-media-filename-list__thumb'],
        attributes: { alt: '', loading: 'eager' }
    }) as HTMLImageElement;
    load_audit_media_thumb_image(audit_id, filename, img, host, resolve_fetch_filename);
    return img;
}

function create_image_thumb_button(
    helpers: HelpersLike,
    t: TranslateFn,
    audit_id: string,
    filename: string,
    host: HTMLElement,
    preview_options?: {
        observation_detail?: string | null;
        observation_edit?: AuditMediaObservationEditOptions | null;
        on_thumb_click?: (thumb_btn: HTMLButtonElement) => void;
        resolve_fetch_filename?: (filename: string) => string;
    }
): HTMLButtonElement {
    const img = helpers.create_element('img', {
        class_name: 'audit-image-card__media-thumb',
        attributes: { alt: '', loading: 'lazy' }
    }) as HTMLImageElement;

    const thumb_btn = helpers.create_element('button', {
        class_name: 'audit-image-card__media-thumb-btn',
        attributes: {
            type: 'button',
            'aria-label': t('audit_media_preview_button_aria', { filename })
        }
    }) as HTMLButtonElement;
    thumb_btn.appendChild(img);

    thumb_btn.addEventListener('click', () => {
        if (preview_options?.on_thumb_click) {
            preview_options.on_thumb_click(thumb_btn);
            return;
        }
        open_audit_media_image_preview({
            t,
            Helpers: helpers,
            audit_id,
            filename,
            blob_url: img.src || get_cached_blob_url(audit_id, filename) || null,
            trigger_element: thumb_btn,
            observation_detail: preview_options?.observation_detail,
            observation_edit: preview_options?.observation_edit
        });
    });

    load_audit_media_thumb_image(
        audit_id,
        filename,
        img,
        host,
        preview_options?.resolve_fetch_filename
    );
    return thumb_btn;
}

function create_media_type_icon_placeholder(
    helpers: HelpersLike,
    kind: 'image' | 'video'
): HTMLElement {
    const icon_name = kind === 'video' ? 'videocam' : 'image';
    const icon_svg = helpers.get_icon_svg
        ? helpers.get_icon_svg(icon_name, ['currentColor'], 32)
        : '';
    return helpers.create_element('span', {
        class_name: ['attach-media-filename-list__placeholder', 'attach-media-filename-list__media-icon'],
        html_content: icon_svg,
        attributes: { 'aria-hidden': 'true' }
    });
}

/**
 * Skapar ett li-element för bifoga-media-modalen med miniatyr och filnamn under.
 */
export function create_attach_media_filename_list_item(
    helpers: HelpersLike,
    t: TranslateFn,
    audit_id: string | null | undefined,
    filename: string,
    on_remove: (trigger: HTMLButtonElement) => void,
    on_image_click?: (filename: string, trigger: HTMLButtonElement) => void,
    resolve_fetch_filename?: (filename: string) => string,
    on_rename?: (filename: string, trigger: HTMLButtonElement) => void
): HTMLLIElement {
    const li = helpers.create_element('li', {
        class_name: 'attach-media-filename-list__item'
    }) as HTMLLIElement;

    const preview = helpers.create_element('div', {
        class_name: 'attach-media-filename-list__preview'
    });

    if (audit_id && is_previewable_image_filename(filename)) {
        if (on_image_click) {
            preview.appendChild(
                create_image_thumb_button(helpers, t, audit_id, filename, li, {
                    on_thumb_click: (thumb_btn) => on_image_click(filename, thumb_btn),
                    resolve_fetch_filename
                })
            );
        } else {
            preview.appendChild(
                create_static_image_thumb(helpers, audit_id, filename, li, resolve_fetch_filename)
            );
        }
    } else if (audit_id) {
        const kind = get_media_display_kind(filename);
        if (kind === 'image' || kind === 'video') {
            preview.appendChild(create_media_type_icon_placeholder(helpers, kind));
        } else {
            preview.appendChild(
                helpers.create_element('span', {
                    class_name: 'attach-media-filename-list__placeholder',
                    attributes: { 'aria-hidden': 'true' }
                })
            );
        }
    } else {
        preview.appendChild(
            helpers.create_element('span', {
                class_name: 'attach-media-filename-list__placeholder',
                attributes: { 'aria-hidden': 'true' }
            })
        );
    }

    preview.appendChild(
        helpers.create_element('span', {
            class_name: 'attach-media-filename-list__name',
            text_content: filename
        })
    );
    li.appendChild(preview);

    const icon_svg = helpers.get_icon_svg
        ? helpers.get_icon_svg('delete', ['currentColor'], 16)
        : '';
    const actions = helpers.create_element('div', { class_name: 'attach-media-filename-list__actions' });

    if (on_rename) {
        const rename_btn = helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small'],
            attributes: {
                type: 'button',
                'aria-label': t('attach_media_rename_file_aria', { filename })
            },
            text_content: t('attach_media_rename_file_short')
        }) as HTMLButtonElement;
        rename_btn.addEventListener('click', () => on_rename(filename, rename_btn));
        actions.appendChild(rename_btn);
    }

    const remove_btn = helpers.create_element('button', {
        class_name: ['button', 'button-danger', 'button-small', 'generic-table-download-btn'],
        html_content: `<span>${t('attach_media_remove_file_short')}</span>${icon_svg}`,
        attributes: {
            type: 'button',
            'aria-label': t('attach_media_remove_file_aria', { filename })
        }
    }) as HTMLButtonElement;
    remove_btn.addEventListener('click', () => on_remove(remove_btn));
    actions.appendChild(remove_btn);
    li.appendChild(actions);

    return li;
}

/**
 * Skapar ett li-element för ett filnamn med miniatyr eller nedladdningslänk.
 */
export function create_audit_media_filename_list_item(
    helpers: HelpersLike,
    t: TranslateFn,
    audit_id: string | null | undefined,
    filename: string,
    observation_detail?: string | null,
    observation_edit?: AuditMediaObservationEditOptions | null
): HTMLLIElement {
    const li = helpers.create_element('li', {
        class_name: 'audit-image-card__media-item'
    }) as HTMLLIElement;

    const name_span = helpers.create_element('span', {
        class_name: 'audit-image-card__media-name',
        text_content: filename
    });
    li.appendChild(name_span);

    if (!audit_id) return li;

    if (is_previewable_image_filename(filename)) {
        li.insertBefore(
            create_image_thumb_button(helpers, t, audit_id, filename, li, {
                observation_detail,
                observation_edit
            }),
            name_span
        );
    } else {
        const kind = get_media_display_kind(filename);
        if (kind === 'image' || kind === 'video') {
            li.insertBefore(create_media_type_icon_placeholder(helpers, kind), name_span);
        }
    }

    return li;
}

/**
 * Fyller en ul med mediefilposter.
 */
export function fill_audit_media_filenames_list(
    ul: HTMLElement,
    helpers: HelpersLike,
    t: TranslateFn,
    audit_id: string | null | undefined,
    filenames: string[],
    observation_detail?: string | null,
    observation_edit?: AuditMediaObservationEditOptions | null
): void {
    ul.innerHTML = '';
    filenames.forEach((fn) => {
        ul.appendChild(
            create_audit_media_filename_list_item(
                helpers,
                t,
                audit_id,
                fn,
                observation_detail,
                observation_edit
            )
        );
    });
}
