/**
 * @fileoverview Validering av regelfilens requirements-sektion (objekt eller array).
 */

type TranslateFn = (key: string, replacements?: Record<string, string>) => string;

function validate_requirement_checks(req_id: string, req: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
    if (!req.checks || !Array.isArray(req.checks)) return { ok: true };
    for (const [check_index, check_obj] of (req.checks as unknown[]).entries()) {
        if (!check_obj || typeof check_obj !== 'object') {
            return {
                ok: false,
                message: `Requirement '${req_id}', check ${check_index} must be an object`
            };
        }
        const check = check_obj as Record<string, unknown>;
        if (!check.id || typeof check.id !== 'string' || check.id.trim() === '') {
            return {
                ok: false,
                message: `Requirement '${req_id}', check ${check_index} must have a valid id`
            };
        }
        if (check.passCriteria && Array.isArray(check.passCriteria)) {
            for (const [pc_index, pc_obj] of (check.passCriteria as unknown[]).entries()) {
                if (!pc_obj || typeof pc_obj !== 'object') {
                    return {
                        ok: false,
                        message: `Requirement '${req_id}', check ${check_index}, passCriterion ${pc_index} must be an object`
                    };
                }
                const pc = pc_obj as Record<string, unknown>;
                if (!pc.id || typeof pc.id !== 'string' || pc.id.trim() === '') {
                    return {
                        ok: false,
                        message: `Requirement '${req_id}', check ${check_index}, passCriterion ${pc_index} must have a valid id`
                    };
                }
            }
        }
    }
    return { ok: true };
}

function validate_requirement_info_blocks(req_id: string, req: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
    if (!req.infoBlocks) return { ok: true };
    if (typeof req.infoBlocks !== 'object') {
        return { ok: false, message: `Requirement '${req_id}' infoBlocks måste vara ett objekt` };
    }
    for (const [block_id, block] of Object.entries(req.infoBlocks as Record<string, unknown>)) {
        if (typeof block !== 'object' || block === null) {
            return {
                ok: false,
                message: `Requirement '${req_id}' infoBlocks['${block_id}'] måste vara ett objekt`
            };
        }
        const b = block as Record<string, unknown>;
        if (typeof b.name !== 'string') {
            return {
                ok: false,
                message: `Requirement '${req_id}' infoBlocks['${block_id}'].name måste vara en sträng`
            };
        }
        if (typeof b.expanded !== 'boolean') {
            return {
                ok: false,
                message: `Requirement '${req_id}' infoBlocks['${block_id}'].expanded måste vara en boolean`
            };
        }
        if (b.text !== undefined && typeof b.text !== 'string') {
            return {
                ok: false,
                message: `Requirement '${req_id}' infoBlocks['${block_id}'].text måste vara en sträng`
            };
        }
    }
    return { ok: true };
}

function validate_one_requirement_shape(
    req_obj: unknown,
    req_id: string
): { ok: true } | { ok: false; message: string } {
    if (!req_obj || typeof req_obj !== 'object') {
        return { ok: false, message: `Requirement '${req_id}' must be an object` };
    }
    const req = req_obj as Record<string, unknown>;
    if (!req.title || typeof req.title !== 'string' || req.title.trim() === '') {
        return { ok: false, message: `Requirement '${req_id}' must have a non-empty title` };
    }
    if (!req.id || typeof req.id !== 'string' || req.id.trim() === '') {
        return { ok: false, message: `Requirement '${req_id}' must have a valid id` };
    }
    const checks_res = validate_requirement_checks(req_id, req);
    if (!checks_res.ok) return checks_res;
    if (req.contentType && !Array.isArray(req.contentType)) {
        return { ok: false, message: `Requirement '${req_id}' contentType must be an array if provided` };
    }
    const ib = validate_requirement_info_blocks(req_id, req);
    if (!ib.ok) return ib;
    return { ok: true };
}

/**
 * Validerar att requirements är icke-tomt objekt eller icke-tom array med samma innehållskrav per post.
 */
export function validate_rulefile_requirements_section(
    requirements: unknown,
    t: TranslateFn
): { isValid: boolean; message: string } {
    if (typeof requirements !== 'object' || requirements === null) {
        return { isValid: false, message: t('rule_file_requirements_must_be_object') };
    }
    if (Array.isArray(requirements)) {
        if (requirements.length === 0) {
            return { isValid: false, message: t('rule_file_must_have_at_least_one_requirement') };
        }
        for (let i = 0; i < requirements.length; i += 1) {
            const label = `index_${i}`;
            const one = validate_one_requirement_shape(requirements[i], label);
            if (!one.ok) return { isValid: false, message: one.message };
        }
        return { isValid: true, message: '' };
    }
    const requirement_keys = Object.keys(requirements as Record<string, unknown>);
    if (requirement_keys.length === 0) {
        return { isValid: false, message: t('rule_file_must_have_at_least_one_requirement') };
    }
    for (const [req_id, req_obj] of Object.entries(requirements as Record<string, unknown>)) {
        const one = validate_one_requirement_shape(req_obj, req_id);
        if (!one.ok) return { isValid: false, message: one.message };
    }
    return { isValid: true, message: '' };
}
