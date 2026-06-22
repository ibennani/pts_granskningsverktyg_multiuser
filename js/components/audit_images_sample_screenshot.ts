/**
 * @fileoverview Stickprovets skärmavbildningar i vyn Bifogad media (Bilder).
 */

import { resolve_effective_sample_attached_filenames } from '../logic/sample_attached_media_normalize.js';
import { open_attach_media_modal } from './media/AttachMediaModal.js';
import { collect_attached_media_filenames } from '../logic/audit_attached_media_references.js';
import { fill_audit_media_filenames_list } from './media/render_audit_media_list_item.js';

export const SAMPLE_SCREENSHOT_CARD_PREFIX = '__sample__';

export function is_sample_screenshot_media_item(item: { mediaScope?: string } | null | undefined): boolean {
    return item?.mediaScope === 'sample';
}

export function group_key_for_image_item(item: {
    mediaScope?: string;
    reqId?: string | null;
    sample?: { id?: string } | null;
}): string {
    const sample_id = item?.sample?.id || '';
    if (is_sample_screenshot_media_item(item)) {
        return `${SAMPLE_SCREENSHOT_CARD_PREFIX}::${sample_id}`;
    }
    return `${item?.reqId || ''}::${sample_id}`;
}

export function build_sample_screenshot_group(items: Array<{ sample?: { id?: string; description?: string; url?: string } }>) {
    const first = items[0];
    return {
        is_sample_screenshot: true,
        requirement: null,
        sample: first?.sample || null,
        reqId: null,
        items
    };
}

type ImagesViewCtx = {
    Translation: { t: (key: string, params?: Record<string, unknown>) => string };
    Helpers: Record<string, unknown>;
    getState: () => { auditId?: string | null; samples?: Array<Record<string, unknown>> };
    dispatch: (action: unknown) => void;
    StoreActionTypes: { UPDATE_SAMPLE: string };
    router: (view: string, params?: Record<string, unknown>) => void;
    build_hash: (view: string, params?: Record<string, unknown>) => string;
    deps?: { refreshSideMenuAndTitle?: () => void };
    root?: HTMLElement | null;
    render?: () => void;
};

export function open_sample_screenshot_attach_modal(
    ctx: ImagesViewCtx,
    sample_id: string,
    trigger_btn: HTMLElement | null
): void {
    const helpers = ctx.Helpers as {
        create_element?: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    };
    if (!helpers?.create_element) return;

    const state = ctx.getState();
    const sample = state?.samples?.find((s) => String(s.id) === String(sample_id));
    if (!sample) return;

    const t = ctx.Translation.t;
    const existing = resolve_effective_sample_attached_filenames(
        state as Parameters<typeof resolve_effective_sample_attached_filenames>[0],
        sample
    );

    open_attach_media_modal({
        t,
        Helpers: helpers as never,
        audit_id: state?.auditId ?? null,
        initial_filenames: existing,
        textarea_id: 'attach-sample-media-filenames-images-view',
        media_scope: 'sample',
        trigger_element: trigger_btn,
        get_still_referenced_filenames_after_save: (final_filenames) =>
            collect_attached_media_filenames(state, {
                type: 'sample',
                sampleId: sample_id,
                filenames: final_filenames
            }),
        on_save: (filenames) => {
            ctx.dispatch({
                type: ctx.StoreActionTypes.UPDATE_SAMPLE,
                payload: {
                    sampleId: sample_id,
                    updatedSampleData: {
                        attachedMediaFilenames: filenames
                    },
                    skip_render: true
                }
            });
            ctx.deps?.refreshSideMenuAndTitle?.();
            ctx.render?.();
        }
    });
}

export function create_sample_screenshot_card(
    ctx: ImagesViewCtx,
    group: { sample?: { id?: string; description?: string; url?: string }; items: Array<{ filename?: string }> },
    t: (key: string, params?: Record<string, unknown>) => string,
    is_audit_locked: boolean,
    on_attach_click: (event: Event) => void
): HTMLElement {
    const helpers = ctx.Helpers as {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (s: string) => string;
        add_protocol_if_missing?: (url: string) => string;
        get_external_link_icon_html?: (t: (k: string) => string) => string;
        get_icon_svg?: (name: string, colors?: string[], size?: number) => string;
    };

    const audit_id = ctx.getState()?.auditId ?? null;
    const card = helpers.create_element('article', {
        class_name: 'audit-image-card audit-image-card--sample-screenshot',
        attributes: {
            'data-sample-screenshot': 'true',
            'data-sample-id': group.sample?.id || ''
        }
    });

    const sample_name = group.sample?.description || group.sample?.id || '';
    const sample_url = group.sample?.url?.trim() || '';
    const sample_row = helpers.create_element('h2', {
        class_name: 'audit-image-card__row audit-image-card__requirement-row'
    });
    sample_row.appendChild(
        helpers.create_element('span', {
            class_name: 'audit-image-card__label',
            text_content: `${t('audit_images_card_sample_label')} `
        })
    );
    if (sample_url && helpers.add_protocol_if_missing) {
        const icon_html = helpers.get_external_link_icon_html ? helpers.get_external_link_icon_html(t) : ' ↗';
        const sample_link = helpers.create_element('a', {
            attributes: {
                href: helpers.add_protocol_if_missing(sample_url),
                target: '_blank',
                rel: 'noopener noreferrer'
            },
            html_content: `${helpers.escape_html ? helpers.escape_html(sample_name || sample_url) : sample_name || sample_url}${icon_html}`
        });
        sample_row.appendChild(sample_link);
    } else {
        sample_row.appendChild(document.createTextNode(sample_name || ''));
    }
    card.appendChild(sample_row);

    const filenames = group.items.map((item) => String(item.filename || '').trim()).filter(Boolean);
    const count_label =
        filenames.length === 1
            ? t('audit_images_sample_card_count_singular')
            : t('audit_images_sample_card_count_plural', { count: String(filenames.length) });
    card.appendChild(
        helpers.create_element('p', {
            class_name: 'audit-image-card__count',
            html_content: `<strong>${helpers.escape_html ? helpers.escape_html(count_label) : count_label}</strong>`
        })
    );

    const section = helpers.create_element('div', {
        class_name: 'audit-image-card__pc-section audit-image-card__sample-screenshot-section',
        attributes: { 'data-check-id': SAMPLE_SCREENSHOT_CARD_PREFIX, 'data-pc-id': SAMPLE_SCREENSHOT_CARD_PREFIX }
    });
    const ul = helpers.create_element('ul', { class_name: 'audit-image-card__filenames' });
    fill_audit_media_filenames_list(ul, helpers, t, audit_id, filenames);
    section.appendChild(ul);

    if (!is_audit_locked && group.sample?.id) {
        const attach_btn_label = t('edit_attached_media_button', { count: filenames.length });
        const image_icon = helpers.get_icon_svg ? helpers.get_icon_svg('image', ['currentColor'], 16) : '';
        const video_icon = helpers.get_icon_svg ? helpers.get_icon_svg('videocam', ['currentColor'], 16) : '';
        const attach_icons_html =
            image_icon || video_icon
                ? `<span class="attach-media-button-icons" aria-hidden="true">${image_icon}${video_icon}</span>`
                : '';
        const attach_btn = helpers.create_element('button', {
            class_name: ['button', 'button-default', 'button-small', 'audit-images-attach-btn'],
            attributes: {
                'data-action': 'attach-sample-media',
                'data-sample-id': group.sample.id,
                type: 'button',
                'aria-label': `${attach_btn_label} ${t('attach_media_aria_label_for')} ${t('sample_screenshot_section_label')}`
            },
            html_content: `<span>${helpers.escape_html ? helpers.escape_html(attach_btn_label) : attach_btn_label}</span>${attach_icons_html}`
        });
        attach_btn.addEventListener('click', on_attach_click);
        section.appendChild(attach_btn);
    }

    card.appendChild(section);
    return card;
}

export function patch_sample_screenshot_card(
    list_wrapper: HTMLElement,
    group: { sample?: { id?: string }; items: Array<{ filename?: string }> },
    t: (key: string, params?: Record<string, unknown>) => string,
    audit_id?: string | null
): void {
    const card = list_wrapper.querySelector(
        `.audit-image-card--sample-screenshot[data-sample-id="${CSS.escape(String(group.sample?.id || ''))}"]`
    );
    if (!card) return;

    const filenames = group.items.map((item) => String(item.filename || '').trim()).filter(Boolean);
    const count_strong = card.querySelector('.audit-image-card__count strong');
    if (count_strong) {
        count_strong.textContent =
            filenames.length === 1
                ? t('audit_images_sample_card_count_singular')
                : t('audit_images_sample_card_count_plural', { count: String(filenames.length) });
    }

    const ul = card.querySelector('ul.audit-image-card__filenames');
    if (ul) {
        const helpers = { create_element: (tag: string, opts?: Record<string, unknown>) => {
            const el = document.createElement(tag);
            if (opts?.class_name) {
                const cls = Array.isArray(opts.class_name) ? opts.class_name.join(' ') : String(opts.class_name);
                el.className = cls;
            }
            if (opts?.text_content) el.textContent = String(opts.text_content);
            if (opts?.attributes) {
                Object.entries(opts.attributes as Record<string, string>).forEach(([k, v]) => el.setAttribute(k, v));
            }
            return el;
        } };
        fill_audit_media_filenames_list(ul as HTMLElement, helpers, t, audit_id ?? null, filenames);
    }

    const attach_btn = card.querySelector('button[data-action="attach-sample-media"]');
    if (attach_btn) {
        const attach_btn_label = t('edit_attached_media_button', { count: filenames.length });
        const span = attach_btn.querySelector('span');
        if (span) {
            span.textContent = attach_btn_label;
        }
        attach_btn.setAttribute(
            'aria-label',
            `${attach_btn_label} ${t('attach_media_aria_label_for')} ${t('sample_screenshot_section_label')}`
        );
    }
}
