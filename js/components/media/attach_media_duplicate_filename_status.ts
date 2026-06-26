/**
 * @fileoverview Statusmeddelanden när bifogade filnamn redan finns i aktuellt krav eller granskningsdel.
 */

import { partition_files_for_upload } from '../../logic/audit_media_server_index.js';

export type AttachMediaDuplicateScope = 'requirement' | 'sample';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type EscapeHtmlFn = (value: string) => string;

function format_filename_strong(filename: string, escape_html: EscapeHtmlFn): string {
    return `<strong>${escape_html(filename)}</strong>`;
}

function format_filename_strong_list(filenames: string[], escape_html: EscapeHtmlFn): string {
    return filenames.map((filename) => format_filename_strong(filename, escape_html)).join(', ');
}

function build_single_filename_html_message(
    t: TranslateFn,
    before_key: string,
    after_key: string,
    filename: string,
    escape_html: EscapeHtmlFn
): string {
    return `${t(before_key)}${format_filename_strong(filename, escape_html)}${t(after_key)}`;
}

function build_multiple_filenames_html_message(
    t: TranslateFn,
    before_key: string,
    after_key: string,
    filenames: string[],
    escape_html: EscapeHtmlFn
): string {
    return `${t(before_key)}${format_filename_strong_list(filenames, escape_html)}${t(after_key)}`;
}

/**
 * Bygger HTML för felmeddelande när filer redan finns i aktuellt krav eller granskningsdel.
 */
export function build_attach_media_duplicate_filenames_message(
    t: TranslateFn,
    scope: AttachMediaDuplicateScope,
    filenames: string[],
    escape_html: EscapeHtmlFn
): string {
    const unique = [...new Set(filenames.map((name) => String(name || '').trim()).filter(Boolean))];
    if (unique.length === 0) return '';

    if (unique.length === 1) {
        return build_single_filename_html_message(
            t,
            `attach_media_file_already_in_${scope}_one_before`,
            `attach_media_file_already_in_${scope}_one_after`,
            unique[0],
            escape_html
        );
    }
    return build_multiple_filenames_html_message(
        t,
        `attach_media_file_already_in_${scope}_many_before`,
        `attach_media_file_already_in_${scope}_many_after`,
        unique,
        escape_html
    );
}

/**
 * Filtrerar bort filer vars namn redan finns i aktuell lista och på servern.
 * Äldre filnamnsreferenser utan serverfil blockeras inte.
 */
export function partition_files_by_existing_filenames(
    files: File[],
    existing_filenames: string[],
    server_filenames?: Set<string> | null
): { new_files: File[]; duplicate_names: string[] } {
    return partition_files_for_upload(files, existing_filenames, server_filenames);
}

/**
 * Bygger HTML/text för lyckad uppladdning av en eller flera filer.
 */
export function build_attach_media_upload_success_message(
    t: TranslateFn,
    escape_html: EscapeHtmlFn,
    uploaded_count: number,
    single_filename?: string
): string {
    if (uploaded_count <= 0) return '';
    if (uploaded_count === 1) {
        const filename = String(single_filename || '').trim();
        return build_single_filename_html_message(
            t,
            'attach_media_upload_success_one_before',
            'attach_media_upload_success_one_after',
            filename,
            escape_html
        );
    }
    return t('attach_media_upload_success_many', { count: uploaded_count });
}

/**
 * Bygger HTML/text när filnamn lagts till lokalt (offline-läge).
 */
export function build_attach_media_local_files_added_message(
    t: TranslateFn,
    escape_html: EscapeHtmlFn,
    added_count: number,
    single_filename?: string
): string {
    if (added_count <= 0) return '';
    if (added_count === 1) {
        const filename = String(single_filename || '').trim();
        return build_single_filename_html_message(
            t,
            'attach_media_local_file_added_one_before',
            'attach_media_local_file_added_one_after',
            filename,
            escape_html
        );
    }
    return t('attach_media_local_files_added_many', { count: added_count });
}

/**
 * Bygger HTML när servern gav unikt filnamn p.g.a. krock med annan användare.
 */
export function build_attach_media_upload_renamed_conflict_message(
    t: TranslateFn,
    escape_html: EscapeHtmlFn,
    server_filename: string
): string {
    const filename = String(server_filename || '').trim();
    if (!filename) return '';
    return build_single_filename_html_message(
        t,
        'attach_media_upload_renamed_conflict_before',
        'attach_media_upload_renamed_conflict_after',
        filename,
        escape_html
    );
}
