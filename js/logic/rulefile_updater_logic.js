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
    console.log("%c--- Startar analys av regelfilsändringar (metod: sorterad fält-för-fält) ---", "color: blue; font-weight: bold;");

    const report = { updated_requirements: [], removed_requirements: [] };
    if (!current_audit_state?.ruleFileContent?.requirements || !new_rule_file_content?.requirements) {
        throw new Error("Analysfel: 'requirements' saknas i gamla eller nya regelfilen.");
    }

    const old_reqs = current_audit_state.ruleFileContent.requirements;
    const new_reqs = new_rule_file_content.requirements;
    
    const old_req_keys = Object.keys(old_reqs);
    const new_req_keys = new Set(Object.keys(new_reqs));
    
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

        if (new_req_keys.has(old_key)) {
            new_req_match = new_reqs[old_key];
            matched_new_keys.add(old_key);
        } else {
            const old_map_key = `${old_req.title}::${old_req.standardReference?.text || ''}`;
            const potential_match = new_req_map_by_title_ref.get(old_map_key);
            if (potential_match && !matched_new_keys.has(potential_match.key || potential_match.id)) {
                new_req_match = potential_match;
                matched_new_keys.add(potential_match.key || potential_match.id);
            }
        }

        if (new_req_match) {
            if (has_requirement_content_changed(old_req, new_req_match)) {
                report.updated_requirements.push({ id: old_key, title: old_req.title });
            }
        } else {
            report.removed_requirements.push({ id: old_key, title: old_req.title });
        }
    }

    console.log("%c--- Analys klar ---", "color: blue; font-weight: bold;");
    console.log("Rapport:", report);
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
 * Tillämpar en regelfilsuppdatering på ett befintligt granskningstillstånd.
 * @param {object} current_audit_state
 * @param {object} new_rule_file_content
 * @param {object} report
 * @returns {object} Det nya, uppdaterade state-objektet.
 */
export function apply_rule_file_update(current_audit_state, new_rule_file_content, report) {
    console.log("%c--- Verkställer regelfilsuppdatering ---", "color: green; font-weight: bold;");

    const new_reconciled_state = JSON.parse(JSON.stringify(current_audit_state));
    new_reconciled_state.ruleFileContent = new_rule_file_content;
    new_reconciled_state.uiSettings = current_audit_state.uiSettings;

    const removed_req_ids = new Set(report.removed_requirements.map(r => r.id));
    const updated_req_ids = new Set(report.updated_requirements.map(r => r.id));

    const old_reqs = current_audit_state.ruleFileContent.requirements;
    const new_reqs = new_rule_file_content.requirements;
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

    new_reconciled_state.samples.forEach(sample => {
        const original_results = sample.requirementResults || {};
        const new_results = {};

        for (const old_req_key in original_results) {
            if (removed_req_ids.has(old_req_key)) {
                continue;
            }
            const result_data = original_results[old_req_key];
            if (updated_req_ids.has(old_req_key) && result_data.status !== 'not_audited') {
                result_data.needsReview = true;
            }
            const new_req_key = key_change_map[old_req_key] || old_req_key;
            new_results[new_req_key] = result_data;
        }
        sample.requirementResults = new_results;
    });

    return new_reconciled_state;
}
