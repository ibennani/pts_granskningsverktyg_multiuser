import sv_i18n from '../../js/i18n/sv-SE.json';
import en_i18n from '../../js/i18n/en-GB.json';
import {
    build_appendix2_locale_labels_from_i18n,
    normalize_report_template_appendix_param,
    normalize_rulefile_appendix2,
    read_rulefile_appendix2_labels,
    resolve_appendix2_excel_labels,
} from '../../js/logic/appendix2_excel_template.ts';

describe('appendix2_excel_template', () => {
    test('normalize_report_template_appendix_param accepterar 1, 2 och 3', () => {
        expect(normalize_report_template_appendix_param('1')).toBe('1');
        expect(normalize_report_template_appendix_param('2')).toBe('2');
        expect(normalize_report_template_appendix_param('3')).toBe('3');
        expect(normalize_report_template_appendix_param('')).toBe('');
        expect(normalize_report_template_appendix_param('x')).toBe('');
    });

    test('standardtexter för sv-SE kommer från befintliga i18n-texter', () => {
        const labels = build_appendix2_locale_labels_from_i18n(sv_i18n as Record<string, string>);
        expect(labels.sheetNames.general_info).toBe(sv_i18n.excel_sheet_general_info);
        expect(labels.sheetNames.deficiencies).toBe(sv_i18n.excel_sheet_deficiencies);
        expect(labels.generalInfo[0]?.label).toBe(sv_i18n.case_number);
        expect(labels.deficiencyColumns[0]?.label).toBe(sv_i18n.excel_col_deficiency_id);
    });

    test('standardtexter för en-GB översätts från samma i18n-nycklar som svenska', () => {
        const labels = build_appendix2_locale_labels_from_i18n(en_i18n as Record<string, string>);
        expect(labels.generalInfo.find((entry) => entry.key === 'actor_name')?.label).toBe(
            en_i18n.actor_name
        );
        expect(labels.deficiencyColumns.find((entry) => entry.key === 'id')?.label).toBe(
            en_i18n.excel_col_deficiency_id
        );
    });

    test('normalize_rulefile_appendix2 fyller defaults för regelfilens språk', () => {
        const normalized = normalize_rulefile_appendix2({
            metadata: { language: 'sv-SE' },
        });
        const labels = read_rulefile_appendix2_labels(normalized);
        expect(labels.generalInfo).toHaveLength(6);
        expect(labels.deficiencyColumns).toHaveLength(13);
        expect(labels.generalInfo[0]?.label).toBe(sv_i18n.case_number);
    });

    test('resolve_appendix2_excel_labels använder sparade etiketter', () => {
        const rule_file = normalize_rulefile_appendix2({
            metadata: { language: 'sv-SE' },
            appendix2: {
                labelsByLocale: {
                    'sv-SE': {
                        sheetNames: {
                            general_info: 'Min allmän info',
                            deficiencies: 'Mina brister',
                        },
                        generalInfo: [{ key: 'case_number', label: 'Eget diarienummer' }],
                        deficiencyColumns: [{ key: 'id', label: 'Eget brist-id' }],
                    },
                },
            },
        });
        const resolved = resolve_appendix2_excel_labels(rule_file);
        expect(resolved.sheet_names.general_info).toBe('Min allmän info');
        expect(resolved.sheet_names.deficiencies).toBe('Mina brister');
        expect(resolved.general_info_labels.case_number).toBe('Eget diarienummer');
        expect(resolved.deficiency_column_labels.id).toBe('Eget brist-id');
        expect(resolved.deficiency_column_labels.reqTitle).toBe(sv_i18n.excel_col_req_title);
    });
});
