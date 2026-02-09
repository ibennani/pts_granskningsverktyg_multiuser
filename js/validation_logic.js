// js/validation_logic.js

export function validate_rule_file_json(json_object) {
    const t = window.Translation?.t || ((key) => `**${key}**`);
    console.log("[ValidationLogic] Running validation for new rule file (hierarchical structure)...");

    if (typeof json_object !== 'object' || json_object === null) {
        return { isValid: false, message: t('rule_file_invalid_json') };
    }

    const required_top_keys = ['metadata', 'requirements'];
    for (const key of required_top_keys) {
        if (!(key in json_object)) {
            return { isValid: false, message: t('rule_file_missing_keys', { missingKeys: key }) };
        }
    }
    
    const metadata = json_object.metadata;
    if (typeof metadata !== 'object' || metadata === null) {
        return { isValid: false, message: t('rule_file_metadata_must_be_object') };
    }

    if (!metadata.title || typeof metadata.title !== 'string' || metadata.title.trim() === '') {
        return { isValid: false, message: t('rule_file_metadata_title_required') };
    }

    // --- VALIDATION FOR NEW HIERARCHICAL STRUCTURE ---

    // Validate metadata.blockOrders (new in version 2026.2.r1)
    if (metadata.blockOrders) {
        if (typeof metadata.blockOrders !== 'object') {
            return { isValid: false, message: "metadata.blockOrders måste vara ett objekt" };
        }
        if (metadata.blockOrders.infoBlocks && !Array.isArray(metadata.blockOrders.infoBlocks)) {
            return { isValid: false, message: "metadata.blockOrders.infoBlocks måste vara en array" };
        }
        if (metadata.blockOrders.reportSections && !Array.isArray(metadata.blockOrders.reportSections)) {
            return { isValid: false, message: "metadata.blockOrders.reportSections måste vara en array" };
        }
    }

    // Validate metadata.vocabularies (new in version 2026.2.r1)
    if (metadata.vocabularies) {
        if (typeof metadata.vocabularies !== 'object') {
            return { isValid: false, message: "metadata.vocabularies måste vara ett objekt" };
        }
    }

    // Validate reportTemplate (new in version 2026.2.r1)
    if (json_object.reportTemplate) {
        if (typeof json_object.reportTemplate !== 'object') {
            return { isValid: false, message: "reportTemplate måste vara ett objekt" };
        }
        if (json_object.reportTemplate.sections) {
            if (typeof json_object.reportTemplate.sections !== 'object') {
                return { isValid: false, message: "reportTemplate.sections måste vara ett objekt" };
            }
            // Validate each section
            for (const [section_id, section] of Object.entries(json_object.reportTemplate.sections)) {
                if (typeof section !== 'object') {
                    return { isValid: false, message: `reportTemplate.sections['${section_id}'] måste vara ett objekt` };
                }
                if (typeof section.name !== 'string') {
                    return { isValid: false, message: `reportTemplate.sections['${section_id}'].name måste vara en sträng` };
                }
                if (typeof section.required !== 'boolean') {
                    return { isValid: false, message: `reportTemplate.sections['${section_id}'].required måste vara en boolean` };
                }
                if (section.content !== undefined && typeof section.content !== 'string') {
                    return { isValid: false, message: `reportTemplate.sections['${section_id}'].content måste vara en sträng` };
                }
            }
        }
    }

    // Validate metadata.samples.sampleCategories (old format) or metadata.vocabularies.sampleTypes.sampleCategories (new format)
    // Also check for sampleTypes array as an alternative
    const sampleCategories = metadata.vocabularies?.sampleTypes?.sampleCategories || metadata.samples?.sampleCategories;
    const sampleTypes = metadata.vocabularies?.sampleTypes?.sampleTypes || metadata.samples?.sampleTypes;
    
    // Allow either sampleCategories (hierarchical) or sampleTypes (simple array) to be present
    if (!Array.isArray(sampleCategories) && !Array.isArray(sampleTypes)) {
        return { isValid: false, message: "Regelfilen måste innehålla antingen 'metadata.vocabularies.sampleTypes.sampleCategories' (eller 'metadata.samples.sampleCategories') som en array med minst en kategori, eller 'metadata.vocabularies.sampleTypes.sampleTypes' (eller 'metadata.samples.sampleTypes') som en array med minst en typ." };
    }
    
    // If sampleCategories exists and is not empty, validate its structure
    if (Array.isArray(sampleCategories) && sampleCategories.length > 0) {
        for (const category of sampleCategories) {
            if (!category.id || !category.text || !Array.isArray(category.categories) || category.categories.length === 0) {
                return { isValid: false, message: `Varje objekt i 'sampleCategories' måste ha 'id', 'text', och en 'categories'-array med minst ett objekt. Fel vid: ${category.text || 'Okänd kategori'}` };
            }
            for (const subcat of category.categories) {
                if (!subcat.id || !subcat.text) {
                    return { isValid: false, message: `Varje underkategori i '${category.text}' måste ha 'id' och 'text'.` };
                }
            }
        }
    }
    
    // If sampleTypes exists, validate it's a non-empty array
    if (Array.isArray(sampleTypes) && sampleTypes.length === 0) {
        return { isValid: false, message: "Om 'metadata.vocabularies.sampleTypes.sampleTypes' (eller 'metadata.samples.sampleTypes') finns måste det vara en array med minst en typ." };
    }

    // Validate metadata.vocabularies.contentTypes (new format) or metadata.contentTypes (old format)
    const contentTypes = metadata.vocabularies?.contentTypes || metadata.contentTypes;
    if (!Array.isArray(contentTypes) || contentTypes.length === 0) {
        return { isValid: false, message: "Regelfilen måste innehålla 'metadata.vocabularies.contentTypes' (eller 'metadata.contentTypes') som en array med minst en huvudinnehållstyp." };
    }
    for (const group of contentTypes) {
        if (!group.id || !group.text || !Array.isArray(group.types) || group.types.length === 0) {
            return { isValid: false, message: `Varje objekt i 'contentTypes' måste ha 'id', 'text', och en 'types'-array med minst ett objekt. Fel vid: ${group.text || 'Okänd innehållstyp'}` };
        }
        for (const type of group.types) {
            if (!type.id || !type.text) {
                return { isValid: false, message: `Varje undertyp i '${group.text}' måste ha 'id' och 'text'.` };
            }
        }
    }

    // Validera requirements-objektet
    const requirements = json_object.requirements;
    if (typeof requirements !== 'object' || requirements === null) {
        return { isValid: false, message: t('rule_file_requirements_must_be_object') };
    }

    // Validera att requirements har minst ett krav
    const requirement_keys = Object.keys(requirements);
    if (requirement_keys.length === 0) {
        return { isValid: false, message: t('rule_file_must_have_at_least_one_requirement') };
    }

    // Validera varje requirement
    for (const [req_id, req_obj] of Object.entries(requirements)) {
        if (!req_obj || typeof req_obj !== 'object') {
            return { isValid: false, message: `Requirement '${req_id}' must be an object` };
        }
        
        // Validera obligatoriska fält
        if (!req_obj.title || typeof req_obj.title !== 'string' || req_obj.title.trim() === '') {
            return { isValid: false, message: `Requirement '${req_id}' must have a non-empty title` };
        }
        
        if (!req_obj.id || typeof req_obj.id !== 'string' || req_obj.id.trim() === '') {
            return { isValid: false, message: `Requirement '${req_id}' must have a valid id` };
        }
        
        // Validera checks om de finns
        if (req_obj.checks && Array.isArray(req_obj.checks)) {
            for (const [check_index, check_obj] of req_obj.checks.entries()) {
                if (!check_obj || typeof check_obj !== 'object') {
                    return { isValid: false, message: `Requirement '${req_id}', check ${check_index} must be an object` };
                }
                
                if (!check_obj.id || typeof check_obj.id !== 'string' || check_obj.id.trim() === '') {
                    return { isValid: false, message: `Requirement '${req_id}', check ${check_index} must have a valid id` };
                }
                
                // Validera passCriteria om de finns
                if (check_obj.passCriteria && Array.isArray(check_obj.passCriteria)) {
                    for (const [pc_index, pc_obj] of check_obj.passCriteria.entries()) {
                        if (!pc_obj || typeof pc_obj !== 'object') {
                            return { isValid: false, message: `Requirement '${req_id}', check ${check_index}, passCriterion ${pc_index} must be an object` };
                        }
                        
                        if (!pc_obj.id || typeof pc_obj.id !== 'string' || pc_obj.id.trim() === '') {
                            return { isValid: false, message: `Requirement '${req_id}', check ${check_index}, passCriterion ${pc_index} must have a valid id` };
                        }
                    }
                }
            }
        }
        
        // Validera contentType om det finns
        if (req_obj.contentType && !Array.isArray(req_obj.contentType)) {
            return { isValid: false, message: `Requirement '${req_id}' contentType must be an array if provided` };
        }
        
        // Validera infoBlocks (new in version 2026.2.r1)
        if (req_obj.infoBlocks) {
            if (typeof req_obj.infoBlocks !== 'object') {
                return { isValid: false, message: `Requirement '${req_id}' infoBlocks måste vara ett objekt` };
            }
            // Validate each info block
            for (const [block_id, block] of Object.entries(req_obj.infoBlocks)) {
                if (typeof block !== 'object') {
                    return { isValid: false, message: `Requirement '${req_id}' infoBlocks['${block_id}'] måste vara ett objekt` };
                }
                if (typeof block.name !== 'string') {
                    return { isValid: false, message: `Requirement '${req_id}' infoBlocks['${block_id}'].name måste vara en sträng` };
                }
                if (typeof block.expanded !== 'boolean') {
                    return { isValid: false, message: `Requirement '${req_id}' infoBlocks['${block_id}'].expanded måste vara en boolean` };
                }
                if (block.text !== undefined && typeof block.text !== 'string') {
                    return { isValid: false, message: `Requirement '${req_id}' infoBlocks['${block_id}'].text måste vara en sträng` };
                }
            }
        }
    }

    console.log("[ValidationLogic] Validation passed for hierarchical structure.");
    return { isValid: true, message: t('rule_file_loaded_successfully') };
}

export function validate_saved_audit_file(json_object) {
    const t = window.Translation?.t || ((key) => `**${key}**`);
    if (typeof json_object !== 'object' || json_object === null) {
        return { isValid: false, message: t('error_invalid_saved_audit_file') };
    }

    const required_keys = ['saveFileVersion', 'ruleFileContent', 'auditMetadata', 'auditStatus', 'samples'];
    const missing_keys = required_keys.filter(key => !(key in json_object));

    if (missing_keys.length > 0) {
        console.warn(`[ValidationLogic] Saved audit file is missing keys: ${missing_keys.join(', ')}`);
        return { isValid: false, message: `${t('error_invalid_saved_audit_file')} (Missing: ${missing_keys.join(', ')})` };
    }

    return { isValid: true, message: "Validation of saved audit file OK." };
}
