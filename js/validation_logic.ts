/**
 * @fileoverview Validering av regelfils-JSON och sparad granskningsfil (server och klient).
 */
import { validate_rulefile_requirements_section } from './logic/validation_rulefile_requirements.js';
import { consoleManager } from './utils/console_manager.js';
import {
    resolve_content_types,
    resolve_sample_vocab
} from '../shared/rulefile/rulefile_metadata_vocabularies.js';
import { is_valid_content_type_detection_pattern } from '../shared/rulefile/content_type_detection_pattern.js';

type TranslateFn = (key: string, replacements?: Record<string, string>) => string;

type ValidateOptions = {
    t?: TranslateFn;
    /** Undvik dubbel loggning när regelfilen valideras som del av sparad granskning. */
    skip_console_log?: boolean;
};

function get_t(options: ValidateOptions): TranslateFn {
    if (typeof options.t === 'function') {
        return options.t;
    }
    return (key: string, replacements?: Record<string, string>) => {
        let out = `**${key}**`;
        if (replacements) {
            for (const [k, v] of Object.entries(replacements)) {
                out = out.split(`{${k}}`).join(String(v));
            }
        }
        return out;
    };
}

export function validate_rule_file_json(json_object: unknown, options: ValidateOptions = {}): {
    isValid: boolean;
    message: string;
} {
    const t = get_t(options);
    if (!options.skip_console_log) {
        consoleManager.log('[ValidationLogic] Running validation for new rule file (hierarchical structure)...');
    }

    if (typeof json_object !== 'object' || json_object === null) {
        return { isValid: false, message: t('rule_file_invalid_json') };
    }

    const root = json_object as Record<string, unknown>;
    const required_top_keys = ['metadata', 'requirements'];
    for (const key of required_top_keys) {
        if (!(key in root)) {
            return { isValid: false, message: t('rule_file_missing_keys', { missingKeys: key }) };
        }
    }

    const metadata = root.metadata;
    if (typeof metadata !== 'object' || metadata === null) {
        return { isValid: false, message: t('rule_file_metadata_must_be_object') };
    }
    const meta = metadata as Record<string, unknown>;

    if (!meta.title || typeof meta.title !== 'string' || meta.title.trim() === '') {
        return { isValid: false, message: t('rule_file_metadata_title_required') };
    }

    if (meta.blockOrders) {
        if (typeof meta.blockOrders !== 'object') {
            return { isValid: false, message: t('rule_file_err_metadata_blockorders_object') };
        }
        const bo = meta.blockOrders as Record<string, unknown>;
        if (bo.infoBlocks && !Array.isArray(bo.infoBlocks)) {
            return { isValid: false, message: t('rule_file_err_metadata_blockorders_info_blocks_array') };
        }
        if (bo.reportSections && !Array.isArray(bo.reportSections)) {
            return { isValid: false, message: t('rule_file_err_metadata_blockorders_report_sections_array') };
        }
    }

    if (meta.vocabularies) {
        if (typeof meta.vocabularies !== 'object') {
            return { isValid: false, message: t('rule_file_err_metadata_vocabularies_object') };
        }
    }

    if (root.appendix1) {
        if (typeof root.appendix1 !== 'object' || root.appendix1 === null) {
            return { isValid: false, message: t('rule_file_err_appendix1_object') };
        }
        const appendix1 = root.appendix1 as Record<string, unknown>;
        if (appendix1.summaryText !== undefined && typeof appendix1.summaryText !== 'string') {
            return { isValid: false, message: t('rule_file_err_appendix1_summary_text_string') };
        }
        if (appendix1.coverImage !== undefined && typeof appendix1.coverImage !== 'string') {
            return { isValid: false, message: t('rule_file_err_appendix1_cover_image_string') };
        }
        if (
            appendix1.groupingTaxonomyId !== undefined
            && typeof appendix1.groupingTaxonomyId !== 'string'
        ) {
            return { isValid: false, message: t('rule_file_err_appendix1_grouping_taxonomy_id_string') };
        }
        if (appendix1.sections !== undefined) {
            const sections_raw = appendix1.sections;
            if (sections_raw === null || typeof sections_raw !== 'object') {
                return { isValid: false, message: t('rule_file_err_appendix1_sections_invalid') };
            }
            const section_entries: Array<[string, unknown]> = Array.isArray(sections_raw)
                ? sections_raw.map((section, index) => [String(index), section])
                : Object.entries(sections_raw as Record<string, unknown>);

            for (const [section_key, section] of section_entries) {
                if (typeof section !== 'object' || section === null) {
                    return {
                        isValid: false,
                        message: t('rule_file_err_appendix1_section_not_object', { sectionKey: section_key }),
                    };
                }
                const section_obj = section as Record<string, unknown>;
                const section_id =
                    typeof section_obj.id === 'string' && section_obj.id.trim()
                        ? section_obj.id.trim()
                        : section_key;

                if (Array.isArray(sections_raw)) {
                    if (!section_obj.id || typeof section_obj.id !== 'string' || !section_obj.id.trim()) {
                        return {
                            isValid: false,
                            message: t('rule_file_err_appendix1_section_id_string', { sectionKey: section_key }),
                        };
                    }
                    if (
                        section_obj.kind !== undefined
                        && section_obj.kind !== 'content'
                        && section_obj.kind !== 'deficiency_group'
                    ) {
                        return {
                            isValid: false,
                            message: t('rule_file_err_appendix1_section_kind_invalid', { sectionKey: section_id }),
                        };
                    }
                    if (
                        section_obj.headingLevel !== undefined
                        && section_obj.headingLevel !== 1
                        && section_obj.headingLevel !== 2
                    ) {
                        return {
                            isValid: false,
                            message: t('rule_file_err_appendix1_section_heading_level_invalid', {
                                sectionKey: section_id,
                            }),
                        };
                    }
                    if (section_obj.conceptId !== undefined && typeof section_obj.conceptId !== 'string') {
                        return {
                            isValid: false,
                            message: t('rule_file_err_appendix1_section_concept_id_string', {
                                sectionKey: section_id,
                            }),
                        };
                    }
                }

                if (section_obj.title !== undefined && typeof section_obj.title !== 'string') {
                    return {
                        isValid: false,
                        message: t('rule_file_err_appendix1_section_title_string', { sectionKey: section_id }),
                    };
                }
                if (section_obj.content !== undefined && typeof section_obj.content !== 'string') {
                    return {
                        isValid: false,
                        message: t('rule_file_err_appendix1_section_content_string', { sectionKey: section_id }),
                    };
                }
                if (
                    section_obj.format !== undefined
                    && section_obj.format !== 'list'
                    && section_obj.format !== 'paragraphs'
                ) {
                    return {
                        isValid: false,
                        message: t('rule_file_err_appendix1_section_format_invalid', { sectionKey: section_id }),
                    };
                }
            }
        }
    }

    if (root.appendix2) {
        if (typeof root.appendix2 !== 'object' || root.appendix2 === null) {
            return { isValid: false, message: t('rule_file_err_appendix2_object') };
        }
        const appendix2 = root.appendix2 as Record<string, unknown>;
        if (appendix2.labelsByLocale !== undefined) {
            if (typeof appendix2.labelsByLocale !== 'object' || appendix2.labelsByLocale === null) {
                return { isValid: false, message: t('rule_file_err_appendix2_labels_by_locale_object') };
            }
            for (const [locale, labels] of Object.entries(appendix2.labelsByLocale as Record<string, unknown>)) {
                if (typeof labels !== 'object' || labels === null) {
                    return {
                        isValid: false,
                        message: t('rule_file_err_appendix2_locale_labels_object', { locale }),
                    };
                }
                const labels_obj = labels as Record<string, unknown>;
                if (labels_obj.sheetNames !== undefined) {
                    if (typeof labels_obj.sheetNames !== 'object' || labels_obj.sheetNames === null) {
                        return {
                            isValid: false,
                            message: t('rule_file_err_appendix2_sheet_names_object', { locale }),
                        };
                    }
                    const sheet_names = labels_obj.sheetNames as Record<string, unknown>;
                    for (const sheet_key of ['general_info', 'deficiencies'] as const) {
                        if (sheet_names[sheet_key] === undefined) continue;
                        if (typeof sheet_names[sheet_key] !== 'string') {
                            return {
                                isValid: false,
                                message: t('rule_file_err_appendix2_sheet_name_string', {
                                    locale,
                                    sheetKey: sheet_key,
                                }),
                            };
                        }
                    }
                }
                for (const list_key of ['generalInfo', 'deficiencyColumns'] as const) {
                    const list = labels_obj[list_key];
                    if (list === undefined) continue;
                    if (!Array.isArray(list)) {
                        return {
                            isValid: false,
                            message: t('rule_file_err_appendix2_label_list_array', { locale, listKey: list_key }),
                        };
                    }
                    for (const entry of list) {
                        if (typeof entry !== 'object' || entry === null) {
                            return {
                                isValid: false,
                                message: t('rule_file_err_appendix2_label_entry_object', { locale, listKey: list_key }),
                            };
                        }
                        const entry_obj = entry as Record<string, unknown>;
                        if (typeof entry_obj.key !== 'string') {
                            return {
                                isValid: false,
                                message: t('rule_file_err_appendix2_label_key_string', { locale, listKey: list_key }),
                            };
                        }
                        if (typeof entry_obj.label !== 'string') {
                            return {
                                isValid: false,
                                message: t('rule_file_err_appendix2_label_value_string', { locale, listKey: list_key }),
                            };
                        }
                    }
                }
            }
        }
    }

    if (root.appendix3) {
        if (typeof root.appendix3 !== 'object' || root.appendix3 === null) {
            return { isValid: false, message: t('rule_file_err_appendix3_object') };
        }
        const appendix3 = root.appendix3 as Record<string, unknown>;
        if (appendix3.title !== undefined && typeof appendix3.title !== 'string') {
            return { isValid: false, message: t('rule_file_err_appendix3_title_string') };
        }
        if (appendix3.introText !== undefined && typeof appendix3.introText !== 'string') {
            return { isValid: false, message: t('rule_file_err_appendix3_intro_text_string') };
        }
    }

    if (root.reportTemplate) {
        if (typeof root.reportTemplate !== 'object') {
            return { isValid: false, message: t('rule_file_err_report_template_object') };
        }
        const rt = root.reportTemplate as Record<string, unknown>;
        if (rt.sections) {
            if (typeof rt.sections !== 'object') {
                return { isValid: false, message: t('rule_file_err_report_template_sections_object') };
            }
            for (const [section_id, section] of Object.entries(rt.sections as Record<string, unknown>)) {
                if (typeof section !== 'object' || section === null) {
                    return {
                        isValid: false,
                        message: t('rule_file_err_report_template_section_not_object', { sectionId: section_id })
                    };
                }
                const sec = section as Record<string, unknown>;
                if (typeof sec.name !== 'string') {
                    return {
                        isValid: false,
                        message: t('rule_file_err_report_template_section_name_string', { sectionId: section_id })
                    };
                }
                if (typeof sec.required !== 'boolean') {
                    return {
                        isValid: false,
                        message: t('rule_file_err_report_template_section_required_boolean', { sectionId: section_id })
                    };
                }
                if (sec.content !== undefined && typeof sec.content !== 'string') {
                    return {
                        isValid: false,
                        message: t('rule_file_err_report_template_section_content_string', { sectionId: section_id })
                    };
                }
            }
        }
    }

    const sample_vocab = resolve_sample_vocab(meta);
    const sampleCategories = sample_vocab.sampleCategories;
    const sampleTypes = sample_vocab.sampleTypes;

    if (!Array.isArray(sampleCategories) && !Array.isArray(sampleTypes)) {
        return {
            isValid: false,
            message: t('rule_file_err_sample_categories_or_types_required')
        };
    }

    if (Array.isArray(sampleCategories) && sampleCategories.length > 0) {
        for (const category of sampleCategories as Record<string, unknown>[]) {
            if (
                !category.id ||
                !category.text ||
                !Array.isArray(category.categories) ||
                (category.categories as unknown[]).length === 0
            ) {
                return {
                    isValid: false,
                    message: t('rule_file_err_sample_category_shape', {
                        hint: String(category.text || 'Okänd kategori')
                    })
                };
            }
            for (const subcat of category.categories as Record<string, unknown>[]) {
                if (!subcat.id || !subcat.text) {
                    return {
                        isValid: false,
                        message: t('rule_file_err_sample_subcategory_shape', {
                            categoryText: String(category.text)
                        })
                    };
                }
            }
        }
    }

    if (Array.isArray(sampleTypes) && sampleTypes.length === 0) {
        return {
            isValid: false,
            message: t('rule_file_err_sample_types_nonempty')
        };
    }

    const contentTypes = resolve_content_types(meta);
    if (!Array.isArray(contentTypes) || contentTypes.length === 0) {
        return {
            isValid: false,
            message: t('rule_file_err_content_types_required')
        };
    }
    for (const group of contentTypes as Record<string, unknown>[]) {
        if (!group.id || !group.text || !Array.isArray(group.types) || (group.types as unknown[]).length === 0) {
            return {
                isValid: false,
                message: t('rule_file_err_content_type_group_shape', {
                    hint: String(group.text || 'Okänd innehållstyp')
                })
            };
        }
        for (const typ of group.types as Record<string, unknown>[]) {
            if (!typ.id || !typ.text) {
                return {
                    isValid: false,
                    message: t('rule_file_err_content_type_subtype_shape', {
                        groupText: String(group.text)
                    })
                };
            }
            if (!is_valid_content_type_detection_pattern(typ.detectionPattern)) {
                return {
                    isValid: false,
                    message: t('rule_file_err_content_type_detection_pattern_invalid', {
                        typeText: String(typ.text || typ.id)
                    })
                };
            }
        }
    }

    const rq = validate_rulefile_requirements_section(root.requirements, t);
    if (!rq.isValid) {
        return { isValid: false, message: rq.message };
    }

    if (!options.skip_console_log) {
        consoleManager.log('[ValidationLogic] Validation passed for hierarchical structure.');
    }
    return { isValid: true, message: t('rule_file_validation_complete') };
}

export function validate_saved_audit_file(json_object: unknown, options: ValidateOptions = {}): {
    isValid: boolean;
    message: string;
} {
    const t = get_t(options);
    if (typeof json_object !== 'object' || json_object === null) {
        return { isValid: false, message: t('error_invalid_saved_audit_file') };
    }

    const root = json_object as Record<string, unknown>;
    const required_keys = ['ruleFileContent', 'auditMetadata', 'auditStatus', 'samples'];
    const missing_keys = required_keys.filter((key) => !(key in root));

    if (missing_keys.length > 0) {
        const g = globalThis as typeof globalThis & { ConsoleManager?: { warn?: (...a: unknown[]) => void } };
        if (g.ConsoleManager?.warn) {
            g.ConsoleManager.warn(
                `[ValidationLogic] Saved audit file is missing keys: ${missing_keys.join(', ')}`
            );
        }
        return {
            isValid: false,
            message: t('error_saved_audit_missing_keys', { keys: missing_keys.join(', ') })
        };
    }

    if (!root.ruleFileContent || typeof root.ruleFileContent !== 'object') {
        return { isValid: false, message: t('error_audit_missing_rulefile') };
    }

    if (typeof root.auditMetadata !== 'object' || root.auditMetadata === null) {
        return { isValid: false, message: t('error_saved_audit_metadata_not_object') };
    }

    if (!Array.isArray(root.samples)) {
        return { isValid: false, message: t('error_saved_audit_samples_not_array') };
    }

    if (typeof root.auditStatus !== 'string') {
        return { isValid: false, message: t('error_saved_audit_status_not_string') };
    }

    const rf = root.ruleFileContent as Record<string, unknown>;
    const has_requirements_key = Object.prototype.hasOwnProperty.call(rf, 'requirements');
    if (!has_requirements_key) {
        return { isValid: false, message: t('error_saved_audit_rulefile_missing_requirements') };
    }

    const has_metadata_object = typeof rf.metadata === 'object' && rf.metadata !== null;
    const has_requirements_value = rf.requirements !== undefined && rf.requirements !== null;

    if (has_metadata_object && has_requirements_value) {
        const deep = validate_rule_file_json(rf, { ...options, skip_console_log: true });
        if (!deep.isValid) {
            return {
                isValid: false,
                message: t('error_saved_audit_embedded_rulefile_invalid', { detail: deep.message })
            };
        }
    } else if (has_requirements_value) {
        const rq = validate_rulefile_requirements_section(rf.requirements, t);
        if (!rq.isValid) {
            return { isValid: false, message: rq.message };
        }
    } else {
        return { isValid: false, message: t('error_saved_audit_rulefile_missing_requirements') };
    }

    return { isValid: true, message: t('saved_audit_validation_ok') };
}
