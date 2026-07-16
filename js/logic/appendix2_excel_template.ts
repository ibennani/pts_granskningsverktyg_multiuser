/**
 * @fileoverview Bilaga 2 Excel-malltexter: fliknamn, etiketter för Allmän info och Brister.
 * Standardtexter hämtas från befintliga i18n-filer (sv-SE som källa, en-GB/nb-NO som översättning).
 */
import sv_i18n from '../i18n/sv-SE.json';
import en_i18n from '../i18n/en-GB.json';
import nb_i18n from '../i18n/nb-NO.json';

export const APPENDIX2_SHEET_KEYS = ['general_info', 'deficiencies'] as const;

export const APPENDIX2_GENERAL_INFO_KEYS = [
    'case_number',
    'actor_name',
    'actor_link',
    'auditor_name',
    'start_time',
    'audit_last_updated',
] as const;

export const APPENDIX2_DEFICIENCY_COLUMN_KEYS = [
    'id',
    'reqTitle',
    'reference',
    'sampleName',
    'sampleUrl',
    'deficiencyType',
    'observation',
    'screenshotReference',
    'comment',
    'wcagPerceivable',
    'wcagOperable',
    'wcagUnderstandable',
    'wcagRobust',
] as const;

export type Appendix2SheetKey = (typeof APPENDIX2_SHEET_KEYS)[number];
export type Appendix2GeneralInfoKey = (typeof APPENDIX2_GENERAL_INFO_KEYS)[number];
export type Appendix2DeficiencyColumnKey = (typeof APPENDIX2_DEFICIENCY_COLUMN_KEYS)[number];

export type Appendix2LabelEntry = {
    key: string;
    label: string;
};

export type Appendix2LocaleLabels = {
    sheetNames: Record<Appendix2SheetKey, string>;
    generalInfo: Appendix2LabelEntry[];
    deficiencyColumns: Appendix2LabelEntry[];
};

export type Appendix2RulefileSlice = {
    metadata?: { language?: unknown };
    appendix2?: {
        labelsByLocale?: Record<string, Partial<Appendix2LocaleLabels>>;
    };
};

/** i18n-nycklar för Excel-flikar (samma texter som Excel-exporten använt tidigare). */
export const APPENDIX2_SHEET_I18N_KEYS: Record<Appendix2SheetKey, string> = {
    general_info: 'excel_sheet_general_info',
    deficiencies: 'excel_sheet_deficiencies',
};

/** i18n-nycklar för Allmän info (samma texter som Excel-exporten använt tidigare). */
export const APPENDIX2_GENERAL_INFO_I18N_KEYS: Record<Appendix2GeneralInfoKey, string> = {
    case_number: 'case_number',
    actor_name: 'actor_name',
    actor_link: 'excel_general_service_link',
    auditor_name: 'auditor_name',
    start_time: 'start_time',
    audit_last_updated: 'audit_last_updated',
};

/** i18n-nycklar för Brister-kolumner (samma texter som Excel-exporten använt tidigare). */
export const APPENDIX2_DEFICIENCY_I18N_KEYS: Record<Appendix2DeficiencyColumnKey, string> = {
    id: 'excel_col_deficiency_id',
    reqTitle: 'excel_col_req_title',
    reference: 'excel_col_reference',
    sampleName: 'excel_col_sample_name',
    sampleUrl: 'excel_col_sample_url',
    deficiencyType: 'excel_col_deficiency_type',
    observation: 'excel_col_observation',
    screenshotReference: 'excel_col_screenshot_reference',
    comment: 'excel_col_comment',
    wcagPerceivable: 'excel_col_wcag_perceivable',
    wcagOperable: 'excel_col_wcag_operable',
    wcagUnderstandable: 'excel_col_wcag_understandable',
    wcagRobust: 'excel_col_wcag_robust',
};

function read_i18n_label(i18n: Record<string, string>, key: string, fallback: string): string {
    const value = i18n[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function build_sheet_names_from_i18n(i18n: Record<string, string>): Record<Appendix2SheetKey, string> {
    return {
        general_info: read_i18n_label(i18n, APPENDIX2_SHEET_I18N_KEYS.general_info, 'general_info'),
        deficiencies: read_i18n_label(i18n, APPENDIX2_SHEET_I18N_KEYS.deficiencies, 'deficiencies'),
    };
}

export function build_appendix2_locale_labels_from_i18n(
    i18n: Record<string, string>
): Appendix2LocaleLabels {
    return {
        sheetNames: build_sheet_names_from_i18n(i18n),
        generalInfo: APPENDIX2_GENERAL_INFO_KEYS.map((key) => ({
            key,
            label: read_i18n_label(i18n, APPENDIX2_GENERAL_INFO_I18N_KEYS[key], key),
        })),
        deficiencyColumns: APPENDIX2_DEFICIENCY_COLUMN_KEYS.map((key) => ({
            key,
            label: read_i18n_label(i18n, APPENDIX2_DEFICIENCY_I18N_KEYS[key], key),
        })),
    };
}

const DEFAULTS_BY_LOCALE: Record<string, Appendix2LocaleLabels> = {
    'sv-SE': build_appendix2_locale_labels_from_i18n(sv_i18n as Record<string, string>),
    'en-GB': build_appendix2_locale_labels_from_i18n(en_i18n as Record<string, string>),
    'nb-NO': build_appendix2_locale_labels_from_i18n(nb_i18n as Record<string, string>),
};

const COLUMN_WIDTHS: Record<Appendix2DeficiencyColumnKey, number> = {
    id: 12,
    reqTitle: 45,
    reference: 40,
    sampleName: 30,
    sampleUrl: 40,
    deficiencyType: 48,
    observation: 70,
    screenshotReference: 50,
    comment: 70,
    wcagPerceivable: 14,
    wcagOperable: 14,
    wcagUnderstandable: 14,
    wcagRobust: 12,
};

export function read_rulefile_metadata_language(
    rule_file_content: Appendix2RulefileSlice | null | undefined
): string {
    const lang = rule_file_content?.metadata?.language;
    if (typeof lang === 'string' && lang.trim()) return lang.trim();
    return 'sv-SE';
}

function get_default_labels_for_locale(locale: string): Appendix2LocaleLabels {
    return DEFAULTS_BY_LOCALE[locale] ?? DEFAULTS_BY_LOCALE['sv-SE'];
}

function normalize_label_entries(
    entries: unknown,
    allowed_keys: readonly string[],
    defaults: Appendix2LabelEntry[]
): Appendix2LabelEntry[] {
    const default_map = new Map(defaults.map((entry) => [entry.key, entry.label]));
    const by_key = new Map<string, string>();

    if (Array.isArray(entries)) {
        for (const raw of entries) {
            if (!raw || typeof raw !== 'object') continue;
            const key = String((raw as { key?: unknown }).key ?? '').trim();
            const label = String((raw as { label?: unknown }).label ?? '').trim();
            if (!key || !allowed_keys.includes(key)) continue;
            by_key.set(key, label || default_map.get(key) || key);
        }
    }

    return allowed_keys.map((key) => ({
        key,
        label: by_key.get(key) ?? default_map.get(key) ?? key,
    }));
}

function normalize_sheet_names(
    raw: unknown,
    defaults: Record<Appendix2SheetKey, string>
): Record<Appendix2SheetKey, string> {
    const source =
        raw && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as Partial<Record<Appendix2SheetKey, unknown>>)
            : {};
    return {
        general_info:
            typeof source.general_info === 'string' && source.general_info.trim()
                ? source.general_info.trim()
                : defaults.general_info,
        deficiencies:
            typeof source.deficiencies === 'string' && source.deficiencies.trim()
                ? source.deficiencies.trim()
                : defaults.deficiencies,
    };
}

export function normalize_rulefile_appendix2<T extends Record<string, unknown>>(rule_file: T): T {
    const base = { ...rule_file };
    const locale = read_rulefile_metadata_language(base);
    const defaults = get_default_labels_for_locale(locale);
    const appendix_raw = base.appendix2;

    const appendix_obj =
        appendix_raw && typeof appendix_raw === 'object' && !Array.isArray(appendix_raw)
            ? { ...(appendix_raw as Record<string, unknown>) }
            : {};

    const labels_by_locale =
        typeof appendix_obj.labelsByLocale === 'object' && appendix_obj.labelsByLocale !== null
            ? { ...(appendix_obj.labelsByLocale as Record<string, unknown>) }
            : {};

    const existing_locale = labels_by_locale[locale];
    const locale_slice =
        existing_locale && typeof existing_locale === 'object' && !Array.isArray(existing_locale)
            ? (existing_locale as Partial<Appendix2LocaleLabels>)
            : {};

    labels_by_locale[locale] = {
        sheetNames: normalize_sheet_names(locale_slice.sheetNames, defaults.sheetNames),
        generalInfo: normalize_label_entries(
            locale_slice.generalInfo,
            APPENDIX2_GENERAL_INFO_KEYS,
            defaults.generalInfo
        ),
        deficiencyColumns: normalize_label_entries(
            locale_slice.deficiencyColumns,
            APPENDIX2_DEFICIENCY_COLUMN_KEYS,
            defaults.deficiencyColumns
        ),
    };

    appendix_obj.labelsByLocale = labels_by_locale;
    (base as Record<string, unknown>).appendix2 = appendix_obj;
    return base;
}

export function read_rulefile_appendix2_labels(
    rule_file_content: Appendix2RulefileSlice | null | undefined
): Appendix2LocaleLabels {
    const locale = read_rulefile_metadata_language(rule_file_content ?? undefined);
    const defaults = get_default_labels_for_locale(locale);
    const stored = rule_file_content?.appendix2?.labelsByLocale?.[locale];
    if (!stored) return defaults;

    return {
        sheetNames: normalize_sheet_names(stored.sheetNames, defaults.sheetNames),
        generalInfo: normalize_label_entries(
            stored.generalInfo,
            APPENDIX2_GENERAL_INFO_KEYS,
            defaults.generalInfo
        ),
        deficiencyColumns: normalize_label_entries(
            stored.deficiencyColumns,
            APPENDIX2_DEFICIENCY_COLUMN_KEYS,
            defaults.deficiencyColumns
        ),
    };
}

export function resolve_appendix2_excel_labels(
    rule_file_content: Appendix2RulefileSlice | null | undefined
): {
    sheet_names: Record<Appendix2SheetKey, string>;
    general_info_labels: Record<Appendix2GeneralInfoKey, string>;
    deficiency_column_labels: Record<Appendix2DeficiencyColumnKey, string>;
} {
    const labels = read_rulefile_appendix2_labels(rule_file_content);
    const general_info_labels = {} as Record<Appendix2GeneralInfoKey, string>;
    const deficiency_column_labels = {} as Record<Appendix2DeficiencyColumnKey, string>;

    for (const entry of labels.generalInfo) {
        general_info_labels[entry.key as Appendix2GeneralInfoKey] = entry.label;
    }
    for (const entry of labels.deficiencyColumns) {
        deficiency_column_labels[entry.key as Appendix2DeficiencyColumnKey] = entry.label;
    }

    return {
        sheet_names: { ...labels.sheetNames },
        general_info_labels,
        deficiency_column_labels,
    };
}

export function get_appendix2_deficiency_column_width(key: Appendix2DeficiencyColumnKey): number {
    return COLUMN_WIDTHS[key];
}

export function normalize_report_template_appendix_param(raw: unknown): '' | '1' | '2' | '3' {
    const value = String(raw ?? '').trim();
    if (value === '1' || value === '2' || value === '3') return value;
    return '';
}
