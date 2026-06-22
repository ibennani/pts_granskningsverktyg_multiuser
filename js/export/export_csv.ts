/**
 * @fileoverview CSV-export av brister (harmoniserad med Excel-exporten).
 */

import { escape_for_csv } from './export_format_helpers.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import {
    deficiency_row_to_flat_values,
    prepare_deficiencies_for_export
} from './export_deficiency_rows.js';
import { build_deficiency_export_filename } from './excel_export_helpers.js';

export async function export_to_csv(current_audit: unknown) {
    const t = get_t_internal() as (key: string, opts?: Record<string, unknown>) => string;
    if (!current_audit) {
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    const { deficiencies_data, column_defs } = await prepare_deficiencies_for_export(current_audit, t);
    const column_keys = column_defs.map((def) => def.key);
    const csv_lines = [column_defs.map((def) => escape_for_csv(def.header)).join(';')];

    deficiencies_data.forEach((row) => {
        const values = deficiency_row_to_flat_values(row, column_keys);
        csv_lines.push(values.map((value) => escape_for_csv(value)).join(';'));
    });

    const csv_string = csv_lines.join('\n');
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv_string], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = build_deficiency_export_filename(current_audit as never, t, new Date(), 'csv');

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');
}
