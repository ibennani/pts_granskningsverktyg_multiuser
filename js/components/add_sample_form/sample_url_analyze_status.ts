/**
 * @fileoverview Tooltip-status på knappen «Hämta information» (delad logik med PDF-export).
 */

import { create_tooltip_wrapper } from '../../utils/generic_tooltip.js';
import {
    build_status_icon_tooltip_icon_html,
    reset_status_icon_tooltip,
    set_file_download_trigger_busy,
    set_status_icon_tooltip_feedback,
    type FileDownloadButtonParts,
    type FileDownloadHelpers,
} from '../../utils/file_download_button_ui.js';

export type SampleUrlAnalyzeStatusHost = {
    url_analyze_button_parts: FileDownloadButtonParts | null;
    get_t_internally: () => (key: string, params?: Record<string, unknown>) => string;
    Helpers?: FileDownloadHelpers;
};

export type SampleUrlAnalyzeStatusState = 'idle' | 'loading' | 'success' | 'failed';

export type SampleUrlAnalyzeButtonParts = FileDownloadButtonParts;

const ICON_SIZE = 16;

function get_parts(host: SampleUrlAnalyzeStatusHost): FileDownloadButtonParts | null {
    return host.url_analyze_button_parts;
}

export function create_sample_url_analyze_button(
    Helpers: SampleUrlAnalyzeStatusHost['Helpers'] & {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
    },
    t: (key: string) => string
): SampleUrlAnalyzeButtonParts {
    const button = Helpers.create_element('button', {
        class_name: ['button', 'button-default', 'sample-url-analyze-button'],
        attributes: {
            type: 'button',
            'aria-label': t('sample_url_analyze_button_aria'),
            'data-file-download-busy': 'false',
        },
        html_content: `<span class="sample-url-analyze-button__label">${t('sample_url_analyze_button')}</span>`,
    }) as HTMLButtonElement;

    const { wrapper, tooltip } = create_tooltip_wrapper(Helpers, {
        content: button,
        mode: 'feedback',
        use_overlay: false,
    });

    return { wrapper, button, tooltip };
}

export function set_sample_url_analyze_status(
    component: SampleUrlAnalyzeStatusHost,
    state: SampleUrlAnalyzeStatusState
): void {
    const parts = get_parts(component);
    if (!parts) return;

    const t = component.get_t_internally();
    const Helpers = component.Helpers ?? { create_element: () => document.createElement('span') };

    if (state === 'idle') {
        set_file_download_trigger_busy(parts.button, false);
        reset_status_icon_tooltip(parts);
        return;
    }

    if (state === 'loading') {
        set_file_download_trigger_busy(parts.button, true);
        set_status_icon_tooltip_feedback(
            parts,
            t('sample_url_analyze_status_loading'),
            build_status_icon_tooltip_icon_html(Helpers, 'generating', ICON_SIZE),
            'generating'
        );
        return;
    }

    set_file_download_trigger_busy(parts.button, false);

    if (state === 'success') {
        set_status_icon_tooltip_feedback(
            parts,
            t('sample_url_analyze_status_success'),
            build_status_icon_tooltip_icon_html(Helpers, 'ready', ICON_SIZE),
            'ready'
        );
        return;
    }

    set_status_icon_tooltip_feedback(
        parts,
        t('sample_url_analyze_status_failed'),
        build_status_icon_tooltip_icon_html(Helpers, 'error', ICON_SIZE),
        'error'
    );
}
