/**
 * @fileoverview Validering av regelfils-JSON och sparad granskningsfil (server och klient).
 */
import { validate_rulefile_requirements_section } from './logic/validation_rulefile_requirements.js';
import { consoleManager } from './utils/console_manager.js';

type TranslateFn = (key: string, replacements?: Record<string, string>) => string;

type ValidateOptions = {
    t?: TranslateFn;
};

function get_t(options: ValidateOptions): TranslateFn {
    return typeof options.t === 'function' ? options.t : (key: string) => `**${key}**`;
}

export function validate_rule_file_json(json_object: unknown, options: ValidateOptions = {}): {
    isValid: boolean;
    message: string;
} {
    const t = get_t(options);
    consoleManager.log('[ValidationLogic] Running validation for new rule file (hierarchical structure)...');

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
            return { isValid: false, message: 'metadata.blockOrders måste vara ett objekt' };
        }
        const bo = meta.blockOrders as Record<string, unknown>;
        if (bo.infoBlocks && !Array.isArray(bo.infoBlocks)) {
            return { isValid: false, message: 'metadata.blockOrders.infoBlocks måste vara en array' };
        }
        if (bo.reportSections && !Array.isArray(bo.reportSections)) {
            return { isValid: false, message: 'metadata.blockOrders.reportSections måste vara en array' };
        }
    }

    if (meta.vocabularies) {
        if (typeof meta.vocabularies !== 'object') {
            return { isValid: false, message: 'metadata.vocabularies måste vara ett objekt' };
        }
    }

    if (root.reportTemplate) {
        if (typeof root.reportTemplate !== 'object') {
            return { isValid: false, message: 'reportTemplate måste vara ett objekt' };
        }
        const rt = root.reportTemplate as Record<string, unknown>;
        if (rt.sections) {
            if (typeof rt.sections !== 'object') {
                return { isValid: false, message: 'reportTemplate.sections måste vara ett objekt' };
            }
            for (const [section_id, section] of Object.entries(rt.sections as Record<string, unknown>)) {
                if (typeof section !== 'object' || section === null) {
                    return {
                        isValid: false,
                        message: `reportTemplate.sections['${section_id}'] måste vara ett objekt`
                    };
                }
                const sec = section as Record<string, unknown>;
                if (typeof sec.name !== 'string') {
                    return {
                        isValid: false,
                        message: `reportTemplate.sections['${section_id}'].name måste vara en sträng`
                    };
                }
                if (typeof sec.required !== 'boolean') {
                    return {
                        isValid: false,
                        message: `reportTemplate.sections['${section_id}'].required måste vara en boolean`
                    };
                }
                if (sec.content !== undefined && typeof sec.content !== 'string') {
                    return {
                        isValid: false,
                        message: `reportTemplate.sections['${section_id}'].content måste vara en sträng`
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
            message:
                "Regelfilen måste innehålla antingen 'metadata.vocabularies.sampleTypes.sampleCategories' (eller 'metadata.samples.sampleCategories') som en array med minst en kategori, eller 'metadata.vocabularies.sampleTypes.sampleTypes' (eller 'metadata.samples.sampleTypes') som en array med minst en typ."
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
                    message: `Varje objekt i 'sampleCategories' måste ha 'id', 'text', och en 'categories'-array med minst ett objekt. Fel vid: ${String(category.text || 'Okänd kategori')}`
                };
            }
            for (const subcat of category.categories as Record<string, unknown>[]) {
                if (!subcat.id || !subcat.text) {
                    return {
                        isValid: false,
                        message: `Varje underkategori i '${String(category.text)}' måste ha 'id' och 'text'.`
                    };
                }
            }
        }
    }

    if (Array.isArray(sampleTypes) && sampleTypes.length === 0) {
        return {
            isValid: false,
            message:
                "Om 'metadata.vocabularies.sampleTypes.sampleTypes' (eller 'metadata.samples.sampleTypes') finns måste det vara en array med minst en typ."
        };
    }

    const contentTypes = (vocab?.contentTypes as unknown) || meta.contentTypes;
    if (!Array.isArray(contentTypes) || contentTypes.length === 0) {
        return {
            isValid: false,
            message:
                "Regelfilen måste innehålla 'metadata.vocabularies.contentTypes' (eller 'metadata.contentTypes') som en array med minst en huvudinnehållstyp."
        };
    }
    for (const group of contentTypes as Record<string, unknown>[]) {
        if (!group.id || !group.text || !Array.isArray(group.types) || (group.types as unknown[]).length === 0) {
            return {
                isValid: false,
                message: `Varje objekt i 'contentTypes' måste ha 'id', 'text', och en 'types'-array med minst ett objekt. Fel vid: ${String(group.text || 'Okänd innehållstyp')}`
            };
        }
        for (const typ of group.types as Record<string, unknown>[]) {
            if (!typ.id || !typ.text) {
                return {
                    isValid: false,
                    message: `Varje undertyp i '${String(group.text)}' måste ha 'id' och 'text'.`
                };
            }
        }
    }

    const rq = validate_rulefile_requirements_section(root.requirements, t);
    if (!rq.isValid) {
        return { isValid: false, message: rq.message };
    }

    consoleManager.log('[ValidationLogic] Validation passed for hierarchical structure.');
    return { isValid: true, message: t('rule_file_loaded_successfully') };
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
            message: `${t('error_invalid_saved_audit_file')} (Missing: ${missing_keys.join(', ')})`
        };
    }

    if (!root.ruleFileContent || typeof root.ruleFileContent !== 'object') {
        return { isValid: false, message: t('error_audit_missing_rulefile') };
    }

    const rf = root.ruleFileContent as Record<string, unknown>;
    if (rf.requirements !== undefined && rf.requirements !== null) {
        const rq = validate_rulefile_requirements_section(rf.requirements, t);
        if (!rq.isValid) {
            return { isValid: false, message: rq.message };
        }
    }

    return { isValid: true, message: 'Validation of saved audit file OK.' };
}
