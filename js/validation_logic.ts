/**
 * @fileoverview Validering av regelfils-JSON och sparad granskningsfil (server och klient).
 */
import { validate_rulefile_requirements_section } from './logic/validation_rulefile_requirements.js';
import { consoleManager } from './utils/console_manager.js';

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

    const vocab = meta.vocabularies as Record<string, unknown> | undefined;
    const samplesMeta = meta.samples as Record<string, unknown> | undefined;
    const sampleTypesBlock = vocab?.sampleTypes as Record<string, unknown> | undefined;
    const sampleCategories =
        (sampleTypesBlock?.sampleCategories as unknown) || (samplesMeta?.sampleCategories as unknown);
    const sampleTypes = (sampleTypesBlock?.sampleTypes as unknown) || (samplesMeta?.sampleTypes as unknown);

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

    const contentTypes = (vocab?.contentTypes as unknown) || meta.contentTypes;
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
