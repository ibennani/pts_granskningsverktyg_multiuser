// @ts-nocheck
// js/export_logic.ts – tunn fasad för export (Word/HTML/CSV/Excel).

import { export_to_csv } from './export/export_csv.js';
import { export_to_excel } from './export/export_excel.js';
import { export_to_word_criterias, export_to_word_samples } from './export/export_word_main_flow.js';
import { export_to_html } from './export/export_html_export.js';

const public_api = {
    export_to_csv,
    export_to_excel,
    export_to_word_criterias,
    export_to_word_samples,
    export_to_html
};

export { public_api };

window.ExportLogic = public_api;
