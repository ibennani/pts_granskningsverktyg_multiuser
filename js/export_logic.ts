/**
 * @fileoverview Tunn fasad för export (Word/HTML/CSV/Excel).
 * Första argumentet till varje export normaliseras lätt (t.ex. samples som array) innan underliggande modul anropas.
 */
import { export_to_csv } from './export/export_csv.js';
import { export_to_excel } from './export/export_excel.js';
import { export_to_word_criterias, export_to_word_samples, export_to_word_deficiency_types, export_to_word_screenshots_appendix, export_observation_texts_word } from './export/export_word_main_flow.js';
import { export_to_html } from './export/export_html_export.js';
import { export_to_images_zip } from './export/export_images_zip_export.js';
import { export_to_pdf_criterias, export_to_pdf_samples, export_to_pdf_deficiency_types, export_to_pdf_screenshots_appendix } from './export/export_pdf_main_flow.js';
import { coerce_audit_for_export } from './logic/coerce_audit_for_export.js';

function wrap_export_first_arg(fn: (audit: unknown, ...rest: unknown[]) => unknown) {
    return (audit: unknown, ...rest: unknown[]) => fn(coerce_audit_for_export(audit as Record<string, unknown>), ...rest);
}

export const public_api = {
    export_to_csv: wrap_export_first_arg(export_to_csv as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_excel: wrap_export_first_arg(export_to_excel as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_word_criterias: wrap_export_first_arg(export_to_word_criterias as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_word_samples: wrap_export_first_arg(export_to_word_samples as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_word_deficiency_types: wrap_export_first_arg(export_to_word_deficiency_types as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_word_screenshots_appendix: wrap_export_first_arg(export_to_word_screenshots_appendix as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_html: wrap_export_first_arg(export_to_html as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_images_zip: wrap_export_first_arg(export_to_images_zip as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_pdf_criterias: wrap_export_first_arg(export_to_pdf_criterias as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_pdf_samples: wrap_export_first_arg(export_to_pdf_samples as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_pdf_deficiency_types: wrap_export_first_arg(export_to_pdf_deficiency_types as (audit: unknown, ...rest: unknown[]) => unknown),
    export_to_pdf_screenshots_appendix: wrap_export_first_arg(export_to_pdf_screenshots_appendix as (audit: unknown, ...rest: unknown[]) => unknown),
    export_observation_texts_word: wrap_export_first_arg(export_observation_texts_word as (audit: unknown, ...rest: unknown[]) => unknown)
};

declare global {
    interface Window {
        ExportLogic: typeof public_api;
    }
}

window.ExportLogic = public_api;
