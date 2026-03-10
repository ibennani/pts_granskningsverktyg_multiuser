// js/logic/rulefile_updater_logic.js
'use-strict';

/**
 * Djup jämförelse av två objekt genom att konvertera dem till JSON-strängar.
 * @param {object} obj1
 * @param {object} obj2
 * @returns {boolean}
 */
function deep_equals(obj1, obj2) {
    // Normalisera undefined till null för konsekvent JSON-strängifiering
    const stable_obj1 = obj1 === undefined ? null : obj1;
    const stable_obj2 = obj2 === undefined ? null : obj2;
    return JSON.stringify(stable_obj1) === JSON.stringify(stable_obj2);
}

/**
 * Analyserar en ny regelfil mot en pågående granskning.
 * @param {object} current_audit_state
 * @param {object} new_rule_file_content
 * @returns {object} Rapportobjekt.
 */
export function analyze_rule_file_changes(current_audit_state, new_rule_file_content) {
    const report = { updated_requirements: [], removed_requirements: [], added_requirements: [] };
    if (!current_audit_state?.ruleFileContent?.requirements || !new_rule_file_content?.requirements) {
        throw new Error("Analysfel: 'requirements' saknas i gamla eller nya regelfilen.");
    }

    const old_reqs = normalize_requirements_to_object(current_audit_state.ruleFileContent.requirements);
    const new_reqs = normalize_requirements_to_object(new_rule_file_content.requirements);

    const old_req_keys = Object.keys(old_reqs);
    const new_req_keys = Object.keys(new_reqs);
    const new_req_keys_set = new Set(new_req_keys);
    
    const new_req_map_by_title_ref = new Map();
    for (const key of new_req_keys) {
        const req = new_reqs[key];
        const map_key = `${req.title}::${req.standardReference?.text || ''}`;
        new_req_map_by_title_ref.set(map_key, req);
    }

    const matched_new_keys = new Set();

    for (const old_key of old_req_keys) {
        const old_req = old_reqs[old_key];
        let new_req_match = null;

        if (new_req_keys_set.has(old_key)) {
            new_req_match = new_reqs[old_key];
            matched_new_keys.add(old_key);
        } else {
            const old_map_key = `${old_req.title}::${old_req.standardReference?.text || ''}`;
            const potential_match = new_req_map_by_title_ref.get(old_map_key);
            if (potential_match) {
                const new_key = Object.keys(new_reqs).find(k => new_reqs[k] === potential_match) || potential_match.key || potential_match.id;
                if (new_key && !matched_new_keys.has(new_key)) {
                    new_req_match = potential_match;
                    matched_new_keys.add(new_key);
                }
            }
        }

        if (new_req_match) {
            if (has_requirement_content_changed(old_req, new_req_match)) {
                const passCriteriaChanges = get_pass_criteria_changes(old_req, new_req_match);
                report.updated_requirements.push({ id: old_key, title: old_req.title, passCriteriaChanges });
            }
        } else {
            report.removed_requirements.push({ id: old_key, title: old_req.title });
        }
    }

    for (const new_key of new_req_keys) {
        if (!matched_new_keys.has(new_key)) {
            const req = new_reqs[new_key];
            report.added_requirements.push({ id: new_key, title: req?.title || new_key });
        }
    }

    return report;
}

/**
 * Sorterar en lista med objekt baserat på deras 'id'-egenskap.
 * @param {Array} list - Listan som ska sorteras.
 * @returns {Array} En ny, sorterad lista.
 */
function sort_by_id(list) {
    if (!Array.isArray(list)) return list; // Returnera oförändrad om det inte är en lista
    return [...list].sort((a, b) => {
        const idA = a.id || '';
        const idB = b.id || '';
        if (idA < idB) return -1;
        if (idA > idB) return 1;
        return 0;
    });
}

/**
 * Normaliserar 'instructions'-fältet till en jämförbar sträng.
 * Hanterar strängar, array av objekt, och null/undefined.
 * @param {string|Array|undefined} instr - instructions-värdet.
 * @returns {string} En normaliserad sträng.
 */
function normalize_instructions(instr) {
    if (!instr) {
        return "";
    }
    if (typeof instr === 'string') {
        return instr.trim();
    }
    if (Array.isArray(instr)) {
        const text_content = instr
            .map(item => (typeof item === 'object' && item.text) ? item.text : String(item))
            .join('\n\n') // Sammanfoga med dubbla nyradstecken för att representera stycken
            .trim();
        
        if (text_content === '---Instruktion saknas---') {
            return "";
        }
        return text_content;
    }
    return "";
}

/**
 * Jämför innehållet i ett gammalt och ett nytt krav fält-för-fält med specialregler.
 * @param {object} old_req
 * @param {object} new_req
 * @returns {boolean} - True om en relevant ändring har skett.
 */
function has_requirement_content_changed(old_req, new_req) {
    const simple_fields_to_compare = [
        'title', 'expectedObservation', 'exceptions', 'tips', 
        'commonErrors', 'contentType', 'metadata'
    ];

    for (const field of simple_fields_to_compare) {
        if (!deep_equals(old_req[field], new_req[field])) return true;
    }

    const old_instructions_text = normalize_instructions(old_req.instructions);
    const new_instructions_text = normalize_instructions(new_req.instructions);
    if (old_instructions_text !== new_instructions_text) return true;

    // *** KORRIGERING: Skapa en funktion för att normalisera checks-arrayen ***
    const normalizeChecksArray = (checks) => {
        if (!Array.isArray(checks)) return [];
        return checks.map(c => {
            const normalized_check = { ...c };
            if (Array.isArray(normalized_check.passCriteria)) {
                normalized_check.passCriteria = normalized_check.passCriteria.map(pc => {
                    const normalized_pc = { ...pc };
                    delete normalized_pc.failureStatementTemplate; // Ta bort fältet
                    return normalized_pc;
                });
            }
            if (Array.isArray(normalized_check.ifNo) && normalized_check.ifNo.length === 0) {
                delete normalized_check.ifNo;
            }
            return normalized_check;
        });
    };

    const old_checks_normalized = normalizeChecksArray(old_req.checks);
    const new_checks_normalized = normalizeChecksArray(new_req.checks);
    
    if (!deep_equals(sort_by_id(old_checks_normalized), sort_by_id(new_checks_normalized))) {
        return true;
    }

    if (!deep_equals(sort_by_id(old_req.examples), sort_by_id(new_req.examples))) {
        return true;
    }

    return false;
}

/**
 * Returnerar vilka kontrollpunkter och godkännandekriterier som tillkommit eller uppdaterats.
 * @param {object} old_req - Krav från gamla regelfilen
 * @param {object} new_req - Krav från nya regelfilen
 * @returns {{ addedChecks: string[], added: { checkId: string, passCriterionId: string, text: string }[], updated: { checkId: string, passCriterionId: string, text: string }[] }}
 */
function get_check_id(check_obj) {
    return check_obj?.id ?? check_obj?.key ?? null;
}

function get_pc_id(pc_obj) {
    return pc_obj?.id ?? pc_obj?.key ?? null;
}

/**
 * Normaliserar requirements till ett objekt keyat av req.key eller req.id.
 * @param {object|Array} requirements
 * @returns {object}
 */
function normalize_requirements_to_object(requirements) {
    if (!requirements || typeof requirements !== 'object') return {};
    if (!Array.isArray(requirements)) return requirements;
    const out = {};
    requirements.forEach(req => {
        if (!req || typeof req !== 'object') return;
        const key = req.key || req.id;
        if (key != null) out[key] = req;
    });
    return out;
}

/**
 * Normaliserar text för innehållsmatchning (condition, requirement).
 * @param {string|undefined} str
 * @returns {string}
 */
function normalize_text_for_match(str) {
    if (str == null) return '';
    const t = typeof str === 'string' ? str : String(str);
    return t.trim().toLowerCase();
}

/**
 * Bygger mappning gamla check-id -> nya check-id och per gammal check gamla pc-id -> nya pc-id.
 * Matchning sker på normaliserad condition- resp. requirement-text; ordning används som tie-breaker.
 * @param {object} old_req - Kravdefinition från gamla regelfilen
 * @param {object} new_req - Kravdefinition från nya regelfilen
 * @returns {{ oldCheckIdToNewCheckId: Record<string, string>, oldPcIdToNewPcIdByOldCheckId: Record<string, Record<string, string>> }}
 */
function build_check_and_pc_id_mappings(old_req, new_req) {
    const oldCheckIdToNewCheckId = {};
    const oldPcIdToNewPcIdByOldCheckId = {};

    const old_checks = Array.isArray(old_req?.checks) ? old_req.checks : [];
    const new_checks = Array.isArray(new_req?.checks) ? new_req.checks : [];

    // Matcha checks på normaliserad condition; vid lika text använd ordning (första mot första).
    const old_by_condition = new Map(); // normalized_condition -> [old_check, ...] i ordning
    old_checks.forEach(c => {
        const key = normalize_text_for_match(c.condition);
        if (!old_by_condition.has(key)) old_by_condition.set(key, []);
        old_by_condition.get(key).push(c);
    });
    const consumed_old = new Set(); // index i old_checks som redan parats

    new_checks.forEach(new_check => {
        const new_id = get_check_id(new_check);
        if (!new_id) return;
        const key = normalize_text_for_match(new_check.condition);
        const candidates = old_by_condition.get(key) || [];
        const old_check = candidates.find(c => {
            const idx = old_checks.indexOf(c);
            return idx >= 0 && !consumed_old.has(idx);
        });
        if (old_check) {
            const old_id = get_check_id(old_check);
            if (old_id) {
                oldCheckIdToNewCheckId[old_id] = new_id;
                consumed_old.add(old_checks.indexOf(old_check));

                // Per check: matcha passCriteria på normaliserad requirement
                const old_pcs = Array.isArray(old_check.passCriteria) ? old_check.passCriteria : [];
                const new_pcs = Array.isArray(new_check.passCriteria) ? new_check.passCriteria : [];
                const pc_map = {};
                const old_by_req = new Map();
                old_pcs.forEach(pc => {
                    const pk = normalize_text_for_match(pc.requirement);
                    if (!old_by_req.has(pk)) old_by_req.set(pk, []);
                    old_by_req.get(pk).push(pc);
                });
                const consumed_pc = new Set();

                new_pcs.forEach(new_pc => {
                    const new_pc_id = get_pc_id(new_pc);
                    if (!new_pc_id) return;
                    const pk = normalize_text_for_match(new_pc.requirement);
                    const pc_candidates = old_by_req.get(pk) || [];
                    const old_pc = pc_candidates.find(p => {
                        const idx = old_pcs.indexOf(p);
                        return idx >= 0 && !consumed_pc.has(idx);
                    });
                    if (old_pc) {
                        const old_pc_id = get_pc_id(old_pc);
                        if (old_pc_id) {
                            pc_map[old_pc_id] = new_pc_id;
                            consumed_pc.add(old_pcs.indexOf(old_pc));
                        }
                    }
                });
                oldPcIdToNewPcIdByOldCheckId[old_id] = pc_map;
            }
        }
    });

    return { oldCheckIdToNewCheckId, oldPcIdToNewPcIdByOldCheckId };
}

/**
 * Omstrukturera ett kravresultat så att checkResults och passCriteria använder nya ID:n enligt mappning.
 * @param {object} old_result - Befintligt requirementResult (checkResults nycklade med gamla id:n)
 * @param {{ oldCheckIdToNewCheckId: Record<string, string>, oldPcIdToNewPcIdByOldCheckId: Record<string, Record<string, string>> }} mappings
 * @returns {object} Nytt resultatobjekt med samma toppnivåfält men checkResults med nya id:n
 */
function remap_requirement_result_to_new_ids(old_result, mappings) {
    const { oldCheckIdToNewCheckId, oldPcIdToNewPcIdByOldCheckId } = mappings;
    const new_check_results = {};
    const old_check_results = old_result.checkResults || {};

    for (const old_check_id in old_check_results) {
        const new_check_id = oldCheckIdToNewCheckId[old_check_id];
        if (!new_check_id) continue;

        const old_cr = old_check_results[old_check_id];
        const pc_map = oldPcIdToNewPcIdByOldCheckId[old_check_id] || {};
        const new_pass_criteria = {};
        if (old_cr.passCriteria && typeof old_cr.passCriteria === 'object') {
            for (const old_pc_id in old_cr.passCriteria) {
                const new_pc_id = pc_map[old_pc_id];
                if (new_pc_id != null) {
                    new_pass_criteria[new_pc_id] = old_cr.passCriteria[old_pc_id];
                }
            }
        }

        new_check_results[new_check_id] = {
            ...old_cr,
            passCriteria: new_pass_criteria
        };
    }

    const result = { ...old_result };
    result.checkResults = new_check_results;
    return result;
}

function get_pass_criteria_changes(old_req, new_req) {
    const result = { addedChecks: [], added: [], updated: [] };
    const old_checks = Array.isArray(old_req?.checks) ? old_req.checks : [];
    const new_checks = Array.isArray(new_req?.checks) ? new_req.checks : [];

    for (const new_check of new_checks) {
        const new_check_id = get_check_id(new_check);
        if (!new_check_id) continue;
        const old_check = old_checks.find(c => get_check_id(c) === new_check_id);
        const new_pcs = Array.isArray(new_check.passCriteria) ? new_check.passCriteria : [];

        if (!old_check) {
            result.addedChecks.push(new_check_id);
            new_pcs.forEach(pc => {
                const pc_id = get_pc_id(pc);
                if (pc_id) {
                    result.added.push({
                        checkId: new_check_id,
                        passCriterionId: pc_id,
                        text: pc.requirement || ''
                    });
                }
            });
            continue;
        }

        const old_pcs = Array.isArray(old_check.passCriteria) ? old_check.passCriteria : [];
        const old_pc_by_id = new Map(old_pcs.map(pc => [get_pc_id(pc), pc]).filter(([id]) => id));

        for (const new_pc of new_pcs) {
            const pc_id = get_pc_id(new_pc);
            if (!pc_id) continue;
            const old_pc = old_pc_by_id.get(pc_id);
            const text = new_pc.requirement || '';
            if (!old_pc) {
                result.added.push({ checkId: new_check_id, passCriterionId: pc_id, text });
            } else {
                const old_normalized = { ...old_pc };
                delete old_normalized.failureStatementTemplate;
                const new_normalized = { ...new_pc };
                delete new_normalized.failureStatementTemplate;
                if (!deep_equals(old_normalized, new_normalized)) {
                    result.updated.push({ checkId: new_check_id, passCriterionId: pc_id, text });
                }
            }
        }
    }

    return result;
}

/**
 * Tillämpar en regelfilsuppdatering på ett befintligt granskningstillstånd.
 * - Uppdaterar ruleFileContent till den nya regelfilen.
 * - Flyttar requirementResults för borttagna krav till ett arkivfält på state-nivå (archivedRequirementResults).
 * - Märker befintliga resultat för uppdaterade krav med needsReview där det är relevant.
 * - Mappar checkResults och passCriteria från gamla ID:n till nya (på innehåll) så att status och bristbeskrivningar bevaras.
 * @param {object} current_audit_state
 * @param {object} new_rule_file_content
 * @param {{ updated_requirements: Array<{id:string,title:string}>, removed_requirements: Array<{id:string,title:string}> }} report
 * @returns {object} Det nya, uppdaterade state-objektet.
 */
export function apply_rule_file_update(current_audit_state, new_rule_file_content, report) {
    const new_reconciled_state = JSON.parse(JSON.stringify(current_audit_state));

    const old_reqs_raw = current_audit_state.ruleFileContent?.requirements;
    const new_reqs_raw = new_rule_file_content?.requirements;
    const old_reqs = normalize_requirements_to_object(old_reqs_raw);
    const new_reqs = normalize_requirements_to_object(new_reqs_raw);

    const new_rule_content_normalized = { ...new_rule_file_content, requirements: new_reqs };
    new_reconciled_state.ruleFileContent = new_rule_content_normalized;
    new_reconciled_state.uiSettings = current_audit_state.uiSettings;

    const removed_req_ids = new Set(report.removed_requirements.map(r => r.id));
    const updated_req_ids = new Set(report.updated_requirements.map(r => r.id));

    const new_req_map_by_title_ref = new Map();
    Object.values(new_reqs).forEach(req => {
        const map_key = `${req.title}::${req.standardReference?.text || ''}`;
        new_req_map_by_title_ref.set(map_key, req);
    });

    const key_change_map = {}; // old_key -> new_key
    Object.keys(old_reqs).forEach(old_key => {
        if (!new_reqs[old_key]) {
            const old_req = old_reqs[old_key];
            const old_map_key = `${old_req.title}::${old_req.standardReference?.text || ''}`;
            const new_req_match = new_req_map_by_title_ref.get(old_map_key);
            if (new_req_match) {
                key_change_map[old_key] = new_req_match.key || new_req_match.id;
            }
        }
    });

    const archived_by_requirement_id = {}; // old_req_key -> { requirementId, title, reference, originalRuleVersion, archivedAt, samples: [...] }

    new_reconciled_state.samples.forEach(sample => {
        const original_results = sample.requirementResults || {};
        const new_results = {};

        for (const old_req_key in original_results) {
            if (removed_req_ids.has(old_req_key)) {
                const result_data_for_archive = original_results[old_req_key];
                if (result_data_for_archive) {
                    if (!archived_by_requirement_id[old_req_key]) {
                        const old_req_def = old_reqs[old_req_key] || {};
                        archived_by_requirement_id[old_req_key] = {
                            requirementId: old_req_key,
                            title: old_req_def.title || String(old_req_key),
                            reference: old_req_def.standardReference?.text || '',
                            originalRuleVersion: current_audit_state?.ruleFileContent?.metadata?.version || null,
                            archivedAt: new Date().toISOString(),
                            samples: []
                        };
                    }
                    archived_by_requirement_id[old_req_key].samples.push({
                        sampleId: sample.id,
                        sampleDescription: sample.description,
                        requirementResult: result_data_for_archive
                    });
                }
                continue;
            }
            const result_data = original_results[old_req_key];
            const new_req_key = key_change_map[old_req_key] || old_req_key;
            const old_req = old_reqs[old_req_key];
            const new_req = new_reqs[new_req_key];

            let final_result;
            if (old_req && new_req && (old_req.checks?.length || new_req.checks?.length)) {
                const mappings = build_check_and_pc_id_mappings(old_req, new_req);
                final_result = remap_requirement_result_to_new_ids(result_data, mappings);
            } else {
                final_result = result_data;
            }
            if (updated_req_ids.has(old_req_key) && final_result.status !== 'not_audited') {
                final_result.needsReview = true;
            }
            new_results[new_req_key] = final_result;
        }
        sample.requirementResults = new_results;
    });

    new_reconciled_state.requirementUpdateDetails = {};
    (report.updated_requirements || []).forEach(r => {
        const old_key = r.id;
        const old_req = old_reqs[old_key];
        const new_req_obj = new_reqs[old_key] || (old_req && new_req_map_by_title_ref.get(`${old_req.title}::${old_req.standardReference?.text || ''}`));
        const key_in_new = new_req_obj ? Object.keys(new_reqs).find(k => new_reqs[k] === new_req_obj) : null;
        const new_req_key = key_in_new || key_change_map[old_key] || old_key;
        if (r.passCriteriaChanges && new_req_key) {
            new_reconciled_state.requirementUpdateDetails[new_req_key] = r.passCriteriaChanges;
        }
    });

    const existing_archived = Array.isArray(new_reconciled_state.archivedRequirementResults)
        ? new_reconciled_state.archivedRequirementResults
        : [];
    const newly_archived = Object.values(archived_by_requirement_id);
    if (newly_archived.length > 0) {
        new_reconciled_state.archivedRequirementResults = existing_archived.concat(newly_archived);
    } else if (!Array.isArray(new_reconciled_state.archivedRequirementResults)) {
        new_reconciled_state.archivedRequirementResults = existing_archived;
    }

    // Spara en enkel ändringslogg för den senaste regelfilsuppdateringen så att den kan visas i efterhand.
    const previous_version = current_audit_state?.ruleFileContent?.metadata?.version || null;
    const new_version = new_rule_file_content?.metadata?.version || null;
    new_reconciled_state.lastRulefileUpdateLog = {
        createdAt: new Date().toISOString(),
        previousRuleVersion: previous_version,
        newRuleVersion: new_version,
        report: report
    };

    return new_reconciled_state;
}
