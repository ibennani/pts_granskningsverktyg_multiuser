/**

 * @fileoverview Modalinnehåll för import av handläggar-Word.

 */

import { create_observation_word_file_drop_zone } from './observation_word_file_drop_zone.js';

import { parse_observation_word_handling_docx } from '../../import/parse_observation_word_handling_docx.js';

import { build_observation_word_import_diff } from '../../import/observation_word_import_diff.js';

import { build_observation_word_import_apply_payload } from '../../import/observation_word_import_apply.js';

import type { ObservationWordImportDiffResult } from '../../import/observation_word_import_types.js';

import '../../../css/components/observation_word_import_modal.css';



type TranslateFn = (key: string, params?: Record<string, unknown>) => string;



type HelpersLike = {

    create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;

    get_icon_svg?: (name: string, colors?: string[], size?: number) => string;

    escape_html?: (value: string) => string;

};



export type ObservationWordImportModalOptions = {

    t: TranslateFn;

    Helpers: HelpersLike;

    audit: Record<string, unknown>;

    dispatch: (action: { type: string; payload?: unknown }) => void;

    StoreActionTypes: { APPLY_OBSERVATION_WORD_IMPORT: string };

    trigger_element?: HTMLElement | null;

    on_import_complete?: (message: string) => void;

};



type ModalHost = {

    close: (focus_element?: HTMLElement | null) => void;

    dialog_element_ref?: HTMLDialogElement | null;

    shell_container_ref?: HTMLElement | null;

};



function render_analysis_bullet_list(

    container: HTMLElement,

    Helpers: HelpersLike,

    t: TranslateFn,

    diff: ObservationWordImportDiffResult

): void {

    container.replaceChildren();

    const heading_id = 'observation-word-import-analysis-heading';
    const heading = Helpers.create_element('h2', {
        id: heading_id,
        class_name: 'observation-word-import-analysis-heading',
        text_content: t('observation_word_import_analysis_heading'),
    });
    container.appendChild(heading);

    const list = Helpers.create_element('ul', {
        class_name: 'observation-word-import-analysis-list',
        attributes: { 'aria-labelledby': heading_id },
    });



    const bullets: Array<{ key: string; params: Record<string, unknown> }> = [

        {

            key: 'observation_word_import_analysis_total',

            params: { total: diff.summary.total_in_audit },

        },

        {

            key: 'observation_word_import_analysis_changed',

            params: { changed: diff.summary.changed_count },

        },

        {

            key: 'observation_word_import_analysis_missing',

            params: { missing: diff.summary.missing_in_word_count },

        },

        {

            key: 'observation_word_import_analysis_unchanged',

            params: { unchanged: diff.summary.unchanged_count },

        },

        {

            key: 'observation_word_import_analysis_unknown',

            params: { unknown: diff.summary.unknown_in_word_count },

        },

    ];



    for (const bullet of bullets) {

        list.appendChild(

            Helpers.create_element('li', {

                text_content: t(bullet.key, bullet.params),

            })

        );

    }

    container.appendChild(list);



    if (diff.summary.unknown_in_word_count > 0) {

        container.appendChild(

            Helpers.create_element('p', {

                class_name: 'observation-word-import-blocked-note',

                text_content: t('observation_word_import_unknown_ids_blocked'),

            })

        );

    }

}



/**

 * Renderar modalinnehåll för Word-import.

 */

export function setup_observation_word_import_modal_content(

    container: HTMLElement,

    modal: ModalHost,

    options: ObservationWordImportModalOptions

): void {

    const { t, Helpers, audit, dispatch, StoreActionTypes, trigger_element, on_import_complete } = options;

    container.classList.add('modal-body--observation-word-import');

    const shell_el = modal.shell_container_ref

        ?? (container.closest('.modal-content') as HTMLElement | null)

        ?? container;

    const dialog_el = modal.dialog_element_ref ?? (container.closest('dialog') as HTMLDialogElement | null);



    const status_el = Helpers.create_element('p', {

        class_name: 'observation-word-import-status',

        attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' },

    });

    const diff_container = Helpers.create_element('div', {

        class_name: 'observation-word-import-diff-container',

    });

    const actions = Helpers.create_element('div', {

        class_name: ['modal-confirm-actions', 'observation-word-import-actions'],

    });



    let diff_result: ObservationWordImportDiffResult | null = null;

    let analysis_token = 0;



    const apply_btn = Helpers.create_element('button', {

        class_name: ['button', 'button-primary'],

        text_content: t('observation_word_import_apply_button'),

        attributes: { type: 'button' },

    });

    const close_without_save_btn = Helpers.create_element('button', {

        class_name: ['button', 'button-default'],

        text_content: t('observation_word_import_close_without_save_button'),

        attributes: { type: 'button' },

    });



    const refresh_actions = () => {

        actions.replaceChildren();

        if (diff_result?.can_import) {

            actions.appendChild(apply_btn);

        }

        actions.appendChild(close_without_save_btn);

    };



    const run_analysis = async (file: File) => {

        const token = analysis_token + 1;

        analysis_token = token;

        diff_result = null;

        diff_container.replaceChildren();

        status_el.textContent = t('observation_word_import_analyzing');

        status_el.classList.remove('form-error');

        refresh_actions();



        const bytes = await file.arrayBuffer();

        if (token !== analysis_token) return;



        const parse_result = await parse_observation_word_handling_docx(bytes);

        if (token !== analysis_token) return;



        diff_result = build_observation_word_import_diff(audit, parse_result);

        if (!diff_result.parse_ok && diff_result.parse_error_key) {

            status_el.textContent = t(diff_result.parse_error_key);

            status_el.classList.add('form-error');

            diff_container.replaceChildren();

            refresh_actions();

            return;

        }



        status_el.textContent = '';

        status_el.classList.remove('form-error');

        render_analysis_bullet_list(diff_container, Helpers, t, diff_result);

        refresh_actions();

    };



    const drop_zone = create_observation_word_file_drop_zone({

        helpers: Helpers,

        t,

        input_id: 'observation-word-import-file-input',

        additional_drop_targets: [container, shell_el, dialog_el].filter(

            (element): element is HTMLElement => element instanceof HTMLElement

        ),

        paste_modal_root: shell_el,

        on_file: (file) => {

            void run_analysis(file);

        },

        on_status: (message, type = 'error') => {

            status_el.textContent = message;

            status_el.classList.toggle('form-error', type === 'error');

        },

    });



    apply_btn.addEventListener('click', () => {

        if (!diff_result?.can_import) return;

        const payload = build_observation_word_import_apply_payload(audit, diff_result);

        if (payload.changes.length === 0) {

            status_el.textContent = t('observation_word_import_nothing_to_apply');

            status_el.classList.add('form-error');

            return;

        }

        dispatch({

            type: StoreActionTypes.APPLY_OBSERVATION_WORD_IMPORT,

            payload,

        });

        on_import_complete?.(t('observation_word_import_success'));

        modal.close(trigger_element ?? null);

    });



    close_without_save_btn.addEventListener('click', () => {

        modal.close(trigger_element ?? null);

    });



    container.appendChild(drop_zone.group);

    container.appendChild(status_el);

    container.appendChild(diff_container);

    container.appendChild(actions);

    refresh_actions();

}


