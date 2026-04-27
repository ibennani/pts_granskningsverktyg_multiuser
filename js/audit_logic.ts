// @ts-nocheck
// js/audit_logic.ts

import * as Helpers from './utils/helpers.js';
import { get_translation_t } from './utils/translation_access.js';
import { consoleManager } from './utils/console_manager.js';

function get_t_func() {
    return get_translation_t();
}

export function formatDeficiencyId(number, totalCount) {
    const t = get_t_func();
    
    // Bestäm padding baserat på det högsta numret som kommer att användas
    // Detta säkerställer konsistent numrering oavsett antal brister
    let padding = 1;
    if (totalCount >= 100) {
        padding = 3;  // B001, B002, ..., B100
    } else if (totalCount >= 10) {
        padding = 2; // B01, B02, ..., B99
    }
    // För totalCount < 10: padding = 1 (B1, B2, ..., B9)
    
    return `${t('deficiency_prefix', {defaultValue: "B"})}${String(number).padStart(padding, '0')}`;
}

export function removeAllDeficiencyIds(auditState) {
    consoleManager.log("[AuditLogic] Removing all deficiency IDs...");
    const newState = JSON.parse(JSON.stringify(auditState));
    
    (newState.samples || []).forEach(sample => {
        Object.values(sample.requirementResults || {}).forEach(reqResult => {
            Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                Object.values(checkResult.passCriteria || {}).forEach(pcResult => {
                    delete pcResult.deficiencyId;
                });
            });
        });
    });
    
    newState.deficiencyCounter = 1;
    return newState;
}

export function assignSortedDeficiencyIdsOnLock(auditState) {
    consoleManager.log("[AuditLogic] Running assignSortedDeficiencyIdsOnLock...");
    const newState = JSON.parse(JSON.stringify(auditState));
    newState.deficiencyCounter = 1;

    // Ta bort alla befintliga ID:n först
    (newState.samples || []).forEach(sample => {
        Object.values(sample.requirementResults || {}).forEach(reqResult => {
            Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                Object.values(checkResult.passCriteria || {}).forEach(pcResult => {
                    delete pcResult.deficiencyId;
                });
            });
        });
    });

    const failedCriteria = [];
    (newState.samples || []).forEach(sample => {
        // Sortera requirements enligt JSON-objektets ordning
        const sortedReqKeys = Object.keys(sample.requirementResults || {})
            .sort((a, b) => {
                // Hitta index i ruleFileContent.requirements för att behålla ordningen
                const reqOrder = Object.keys(newState.ruleFileContent.requirements || {});
                const indexA = reqOrder.indexOf(a);
                const indexB = reqOrder.indexOf(b);
                return indexA - indexB;
            });

        sortedReqKeys.forEach(reqKey => {
            const reqResult = sample.requirementResults[reqKey];
            const reqDef = find_requirement_definition(newState.ruleFileContent.requirements, reqKey)
                || newState.ruleFileContent.requirements?.[reqKey];
            if (!reqDef || !reqResult) return;

            // Sortera checks enligt JSON-objektets ordning
            const sortedCheckKeys = Object.keys(reqResult.checkResults || {})
                .sort((a, b) => {
                    const checkOrder = (reqDef.checks || []).map(c => c.id);
                    const indexA = checkOrder.indexOf(a);
                    const indexB = checkOrder.indexOf(b);
                    return indexA - indexB;
                });

            sortedCheckKeys.forEach(checkKey => {
                const checkResult = reqResult.checkResults[checkKey];
                const checkDef = reqDef.checks.find(c => c.id === checkKey);
                if (!checkDef || !checkResult) return;

                // Sortera passCriteria enligt JSON-objektets ordning
                const sortedPcKeys = Object.keys(checkResult.passCriteria || {})
                    .sort((a, b) => {
                        const pcOrder = (checkDef.passCriteria || []).map(pc => pc.id);
                        const indexA = pcOrder.indexOf(a);
                        const indexB = pcOrder.indexOf(b);
                        return indexA - indexB;
                    });

                sortedPcKeys.forEach(pcKey => {
                    const pcResult = checkResult.passCriteria[pcKey];
                    const pcDef = checkDef.passCriteria.find(pc => pc.id === pcKey);
                    const originalPcResultRef = newState.samples.find(s => s.id === sample.id)
                        ?.requirementResults[reqKey]
                        ?.checkResults[checkKey]
                        ?.passCriteria[pcKey];

                    if (pcResult.status === 'failed' && pcDef && originalPcResultRef) {
                        failedCriteria.push({
                            sampleDescription: sample.description,
                            reqRefText: reqDef.standardReference?.text || reqDef.title,
                            pcRequirementText: pcDef.requirement,
                            resultObjectToUpdate: originalPcResultRef
                        });
                    }
                });
            });
        });
    });

    let counter = 1;
    const totalCount = failedCriteria.length;
    failedCriteria.forEach(item => {
        item.resultObjectToUpdate.deficiencyId = formatDeficiencyId(counter, totalCount);
        counter++;
    });
    newState.deficiencyCounter = counter;

    return newState;
}

export function updateIncrementalDeficiencyIds(auditState) {
    if (!auditState) return auditState;
    const newState = JSON.parse(JSON.stringify(auditState));
    
    // Under pågående granskning: bara ta bort ID:n från brister som inte längre är failed
    (newState.samples || []).forEach(sample => {
        Object.values(sample.requirementResults || {}).forEach(reqResult => {
            Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                Object.values(checkResult.passCriteria || {}).forEach(pcResult => {
                    if (pcResult.status !== 'failed' && pcResult.deficiencyId) {
                        delete pcResult.deficiencyId;
                    }
                });
            });
        });
    });
    
    return newState;
}

export function calculate_check_status(check_object, pass_criteria_statuses_map, overall_manual_status = 'not_audited') {
    // Om kontrollpunkten saknar bedömningskriterier ska den alltid räknas som godkänd (passed)
    // Detta måste ske innan vi kollar overall_manual_status, eftersom den defaultar till "not_audited"
    if (!check_object?.passCriteria || check_object.passCriteria.length === 0) return "passed";

    if (overall_manual_status === 'failed') return "failed";
    if (overall_manual_status === 'not_applicable') return "passed";
    if (overall_manual_status === 'not_audited') return "not_audited";

    const pc_statuses = check_object.passCriteria.map(pc => {
        const pc_data = (pass_criteria_statuses_map || {})[pc.id];
        return (typeof pc_data === 'object' && pc_data !== null) ? pc_data.status : (pc_data || 'not_audited');
    });
    
    // Hämta logiken från check_object, default till "AND"
    const logic = (check_object.logic || 'AND').toUpperCase();
    
    if (logic === 'OR') {
        // OR-logik: Minst ett måste vara "passed" för att kontrollpunkten ska bli "passed"
        // Kontrollpunkten blir "failed" endast om alla bedömda kriterier är "failed"
        // Om alla är "not_audited" → "not_audited"
        // Om några är "not_audited" och inga är "passed" → "partially_audited"
        
        const has_passed = pc_statuses.some(s => s === 'passed');
        const has_not_audited = pc_statuses.some(s => s === 'not_audited');
        const all_not_audited = pc_statuses.every(s => s === 'not_audited');
        const all_audited_and_failed = !pc_statuses.some(s => s === 'not_audited') && !has_passed;
        
        if (has_passed) return "passed";
        if (all_not_audited) return "partially_audited";
        if (all_audited_and_failed) return "failed";
        if (has_not_audited && !has_passed) return "partially_audited";
        return "failed"; // Fallback
    } else {
        // AND-logik (default): Alla måste vara "passed" för att kontrollpunkten ska bli "passed"
        // Om något är "failed" → "failed"
        // Om något är "not_audited" och resten "passed" → "partially_audited"
        if (pc_statuses.some(s => s === 'failed')) return "failed";
        if (pc_statuses.some(s => s === 'not_audited')) return "partially_audited";
        return "passed";
    }
}

export function calculate_requirement_status(requirement_object, requirement_result_object) {
    // Förbättrad null-säkerhet och validering
    if (!requirement_object || typeof requirement_object !== 'object') {
        console.warn('[AuditLogic] calculate_requirement_status: Invalid requirement_object');
        return "not_audited";
    }
    
    if (!requirement_object.checks || !Array.isArray(requirement_object.checks) || requirement_object.checks.length === 0) {
        return requirement_result_object?.status || "not_audited";
    }
    
    if (!requirement_result_object || typeof requirement_result_object !== 'object' || !requirement_result_object.checkResults) {
        return "not_audited";
    }
    
    try {
        let has_failed_check = false, has_partially_audited_check = false, has_not_audited_check = false, has_any_button_pressed = false;
        
        for (const check_definition of requirement_object.checks) {
            // Validera check_definition
            if (!check_definition || typeof check_definition !== 'object' || !check_definition.id) {
                console.warn('[AuditLogic] calculate_requirement_status: Invalid check_definition:', check_definition);
                has_not_audited_check = true;
                continue;
            }
            
            const checkResultForDef = requirement_result_object.checkResults[check_definition.id];
            let status = 'not_audited';
            
            const overall = checkResultForDef?.overallStatus;
            if (overall === 'passed' || overall === 'not_applicable') {
                has_any_button_pressed = true;
            }
            
            if (checkResultForDef) {
                try {
                    status = calculate_check_status(check_definition, checkResultForDef.passCriteria, checkResultForDef.overallStatus);
                } catch (error) {
                    console.warn('[AuditLogic] calculate_requirement_status: Error calculating check status:', error);
                    status = 'not_audited';
                }
            }

            if (status === "failed") { 
                has_failed_check = true; 
                break; 
            }
            if (status === "partially_audited") has_partially_audited_check = true;
            if (status === "not_audited") has_not_audited_check = true;
        }

        if (has_failed_check) return "failed";
        if (!has_not_audited_check && !has_partially_audited_check) return "passed";
        if (has_any_button_pressed) return "partially_audited";
        return "not_audited";
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[AuditLogic] calculate_requirement_status: Error processing requirement:', error);
        return "not_audited";
    }
}

/**
 * Kanonisk beräknad granskningsstatus för ett krav i ett stickprov.
 * Använder get_stored_requirement_result_for_def + calculate_requirement_status — samma kedja som
 * framstegsräkning, listor och export ska följa.
 *
 * @param {object|Array|null|undefined} requirements ruleFileContent.requirements
 * @param {Record<string, object>|null|undefined} requirement_results sample.requirementResults
 * @param {object} req_def kravdefinition
 * @param {string|number|null|undefined} [entry_map_key]
 * @returns {'passed'|'failed'|'partially_audited'|'not_audited'}
 */
export function get_effective_requirement_audit_status(requirements, requirement_results, req_def, entry_map_key = null) {
    const stored = get_stored_requirement_result_for_def(requirement_results, requirements, req_def, entry_map_key);
    return calculate_requirement_status(req_def, stored);
}

export function get_relevant_requirements_for_sample(rule_file_content, sample) {
    // Förbättrad null-säkerhet och validering
    if (!rule_file_content || typeof rule_file_content !== 'object') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid rule_file_content');
        return [];
    }
    
    if (!rule_file_content.requirements || typeof rule_file_content.requirements !== 'object') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid or missing requirements object');
        return [];
    }
    
    if (!sample || typeof sample !== 'object') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid sample object');
        return [];
    }
    
    try {
        const all_reqs = Object.values(rule_file_content.requirements).filter(req => {
            // Validera att varje requirement är ett giltigt objekt.
            // Stöd både nyare format (key) och äldre format (id).
            return req && typeof req === 'object' && (req.key || req.id);
        });
        
        if (!sample.selectedContentTypes || !Array.isArray(sample.selectedContentTypes) || sample.selectedContentTypes.length === 0) {
            return all_reqs;
        }
        
        return all_reqs.filter(req => {
            if (!req.contentType || !Array.isArray(req.contentType) || req.contentType.length === 0) {
                return true;
            }
            return req.contentType.some(ct => sample.selectedContentTypes.includes(ct));
        });
    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[AuditLogic] get_relevant_requirements_for_sample: Error processing requirements:', error);
        return [];
    }
}

export function get_ordered_relevant_requirement_keys(rule_file_content, sample_object, sort_option = 'default') {
    const t = get_t_func();
    const relevant_reqs = get_relevant_requirements_for_sample(rule_file_content, sample_object);

    if (sort_option === 'default') {
        relevant_reqs.sort((a, b) => {
            const ref_a = a.standardReference?.text || null;
            const ref_b = b.standardReference?.text || null;
            if (ref_a && ref_b) return Helpers.natural_sort(ref_a, ref_b);
            if (ref_a && !ref_b) return -1;
            if (!ref_a && ref_b) return 1;
            return (a.title || '').localeCompare(b.title || '');
        });
    } else if (sort_option === 'category') {
        relevant_reqs.sort((a, b) => {
            const main_a = a.metadata?.mainCategory?.text || t('uncategorized');
            const main_b = b.metadata?.mainCategory?.text || t('uncategorized');
            if (main_a !== main_b) return main_a.localeCompare(main_b);
            const sub_a = a.metadata?.subCategory?.text || t('other_requirements');
            const sub_b = b.metadata?.subCategory?.text || t('other_requirements');
            if (sub_a !== sub_b) return sub_a.localeCompare(sub_b);
            return (a.title || '').localeCompare(b.title || '');
        });
    }
    
    return relevant_reqs.map(req => req.key || req.id);
}

export function calculate_overall_audit_progress(current_audit_data) {
    if (!current_audit_data?.samples || !current_audit_data.ruleFileContent?.requirements) {
        return { audited: 0, total: 0 };
    }

    let total_possible_assessments = 0;
    let total_completed_assessments = 0;

    current_audit_data.samples.forEach(sample => {
        const relevant_reqs = get_relevant_requirements_for_sample(current_audit_data.ruleFileContent, sample);
        total_possible_assessments += relevant_reqs.length;

        relevant_reqs.forEach(req_def => {
            const stored = get_stored_requirement_result_for_def(
                sample.requirementResults,
                current_audit_data.ruleFileContent?.requirements,
                req_def
            );
            const status = calculate_requirement_status(req_def, stored);
            if (status === 'passed' || status === 'failed') {
                total_completed_assessments++;
            }
        });
    });

    return { audited: total_completed_assessments, total: total_possible_assessments };
}

/**
 * Räknar krav per status för ett stickprov (relevanta krav enligt regelfil).
 * Alla tal är heltal ≥ 0.
 * @param {object} rule_file_content
 * @param {object} sample_object
 * @returns {{ passed: number, partially_audited: number, failed: number, not_audited: number, total: number }}
 */
export function calculate_sample_requirement_status_counts(rule_file_content, sample_object) {
    const out = { passed: 0, partially_audited: 0, failed: 0, not_audited: 0, total: 0 };
    if (!rule_file_content?.requirements || !sample_object) {
        return out;
    }
    const relevant_reqs = get_relevant_requirements_for_sample(rule_file_content, sample_object);
    relevant_reqs.forEach((req_def) => {
        const stored = get_stored_requirement_result_for_def(
            sample_object.requirementResults,
            rule_file_content?.requirements,
            req_def
        );
        const status = calculate_requirement_status(req_def, stored);
        if (status === 'passed') out.passed += 1;
        else if (status === 'failed') out.failed += 1;
        else if (status === 'partially_audited') out.partially_audited += 1;
        else out.not_audited += 1;
    });
    out.total = out.passed + out.partially_audited + out.failed + out.not_audited;
    return out;
}

/**
 * Aggregerar kravstatus räknat över alla stickprov.
 * @param {object} current_audit_data
 * @returns {{ passed: number, partially_audited: number, failed: number, not_audited: number, total: number }}
 */
export function calculate_overall_audit_status_counts(current_audit_data) {
    const out = { passed: 0, partially_audited: 0, failed: 0, not_audited: 0, total: 0 };
    if (!current_audit_data?.samples || !current_audit_data.ruleFileContent?.requirements) {
        return out;
    }
    current_audit_data.samples.forEach((sample) => {
        const sample_counts = calculate_sample_requirement_status_counts(
            current_audit_data.ruleFileContent,
            sample
        );
        out.passed += sample_counts.passed;
        out.partially_audited += sample_counts.partially_audited;
        out.failed += sample_counts.failed;
        out.not_audited += sample_counts.not_audited;
    });
    out.total = out.passed + out.partially_audited + out.failed + out.not_audited;
    return out;
}

/**
 * Sant om något relevant krav i stickprovet har needsReview på lagrat resultat (kanonisk uppslagning).
 * @param {object} rule_file_content
 * @param {object} sample
 * @returns {boolean}
 */
export function sample_has_any_requirement_needing_review(rule_file_content, sample) {
    if (!rule_file_content?.requirements || !sample) return false;
    const reqs = rule_file_content.requirements;
    const relevant_reqs = get_relevant_requirements_for_sample(rule_file_content, sample);
    return relevant_reqs.some((req_def) => {
        const stored = get_stored_requirement_result_for_def(
            sample.requirementResults,
            reqs,
            req_def
        );
        return !!(stored && stored.needsReview === true);
    });
}

/**
 * Antal relevanta krav med needsReview över alla stickprov (ett tillfälle per krav och stickprov).
 * @param {object} current_audit_data
 * @returns {number}
 */
export function count_requirements_needing_review_in_audit(current_audit_data) {
    if (!current_audit_data?.samples || !current_audit_data.ruleFileContent?.requirements) {
        return 0;
    }
    const rule = current_audit_data.ruleFileContent;
    let n = 0;
    current_audit_data.samples.forEach((sample) => {
        const relevant_reqs = get_relevant_requirements_for_sample(rule, sample);
        relevant_reqs.forEach((req_def) => {
            const stored = get_stored_requirement_result_for_def(
                sample.requirementResults,
                rule.requirements,
                req_def
            );
            if (stored?.needsReview === true) n += 1;
        });
    });
    return n;
}

export function find_first_incomplete_requirement_key_for_sample(rule_file_content, sample_object, exclude_key = null) {
    if (!sample_object || !rule_file_content?.requirements) return null;
    const ordered_keys = get_ordered_relevant_requirement_keys(rule_file_content, sample_object, 'default');
    for (const req_key of ordered_keys) {
        if (exclude_key && req_key === exclude_key) continue; // Hoppa över det aktuella kravet
        const req_def =
            find_requirement_definition(rule_file_content.requirements, req_key)
            || rule_file_content.requirements[req_key];
        if (!req_def) continue;
        const stored = get_stored_requirement_result_for_def(
            sample_object.requirementResults,
            rule_file_content.requirements,
            req_def,
            req_key
        );
        const status = calculate_requirement_status(req_def, stored);
        if (status === 'not_audited' || status === 'partially_audited') return req_key;
    }
    return null;
}

export function recalculateStatusesOnLoad(auditState) {
    // Beräknar om statusar för alla kontrollpunkter och krav när en granskning laddas in
    // Detta säkerställer att statusar är korrekta även om logiken har ändrats (t.ex. OR-logik fix)
    if (!auditState || !auditState.ruleFileContent || !auditState.samples) {
        return auditState;
    }

    const newState = JSON.parse(JSON.stringify(auditState));
    
    (newState.samples || []).forEach(sample => {
        const requirements = newState.ruleFileContent.requirements;
        Object.keys(sample.requirementResults || {}).forEach(reqKey => {
            const reqDef = find_requirement_definition(requirements, reqKey) || requirements?.[reqKey];
            if (!reqDef) return;
            const reqResult = get_stored_requirement_result_for_def(
                sample.requirementResults,
                requirements,
                reqDef,
                reqKey
            );
            if (!reqResult || !reqResult.checkResults) return;

            // Beräkna om status för varje kontrollpunkt
            Object.keys(reqResult.checkResults).forEach(checkKey => {
                const checkResult = reqResult.checkResults[checkKey];
                const checkDef = reqDef.checks.find(c => c.id === checkKey);
                if (!checkDef || !checkResult) return;

                // Beräkna om kontrollpunktens status med korrekt logik
                const recalculatedStatus = calculate_check_status(
                    checkDef,
                    checkResult.passCriteria,
                    checkResult.overallStatus
                );
                checkResult.status = recalculatedStatus;
            });

            // Beräkna om status för hela kravet
            const recalculatedReqStatus = calculate_requirement_status(reqDef, reqResult);
            reqResult.status = recalculatedReqStatus;
        });
    });

    // Avslutad: beräkna om bristnumrering baserat på korrekta statusar. Arkiverad: fryst data — ingen omnumrering.
    if (newState.auditStatus === 'locked') {
        return assignSortedDeficiencyIdsOnLock(newState);
    }

    return newState;
}

export function recalculateAuditTimes(auditState) {
    if (!auditState || !auditState.samples) {
        return auditState;
    }

    let minTime = null;
    let maxTime = null;

    (auditState.samples || []).forEach(sample => {
        Object.values(sample.requirementResults || {}).forEach(reqResult => {
            // Kolla timestamp på krav-nivå (lastStatusUpdate) för bakåtkompatibilitet och täckning
            if (reqResult.lastStatusUpdate) {
                if (!minTime || reqResult.lastStatusUpdate < minTime) minTime = reqResult.lastStatusUpdate;
                if (!maxTime || reqResult.lastStatusUpdate > maxTime) maxTime = reqResult.lastStatusUpdate;
            }

            Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                // Kolla timestamp på check-nivå
                if (checkResult.timestamp) {
                    if (!minTime || checkResult.timestamp < minTime) minTime = checkResult.timestamp;
                    if (!maxTime || checkResult.timestamp > maxTime) maxTime = checkResult.timestamp;
                }

                // Kolla timestamp på passCriteria-nivå
                if (checkResult.passCriteria) {
                    Object.values(checkResult.passCriteria).forEach(pcResult => {
                        if (pcResult.timestamp) {
                            if (!minTime || pcResult.timestamp < minTime) minTime = pcResult.timestamp;
                            if (!maxTime || pcResult.timestamp > maxTime) maxTime = pcResult.timestamp;
                        }
                    });
                }
            });
        });
    });

    if (minTime || maxTime) {
        const newState = { ...auditState };
        if (minTime) newState.startTime = minTime;
        if (maxTime) newState.endTime = maxTime;
        return newState;
    }
    
    return auditState;
}

/**
 * Returns the most recent activity timestamp from an audit state.
 * Traverses samples -> requirementResults -> checkResults -> passCriteria.
 * @param {Object} audit_state - Audit state object with samples
 * @returns {string|null} ISO timestamp of last activity, or null if none
 */
export function get_last_activity_timestamp(audit_state) {
    if (!audit_state || !audit_state.samples) {
        return null;
    }

    let maxTime = null;

    (audit_state.samples || []).forEach(sample => {
        Object.values(sample.requirementResults || {}).forEach(reqResult => {
            if (reqResult.lastStatusUpdate) {
                if (!maxTime || reqResult.lastStatusUpdate > maxTime) maxTime = reqResult.lastStatusUpdate;
            }

            Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                if (checkResult.timestamp) {
                    if (!maxTime || checkResult.timestamp > maxTime) maxTime = checkResult.timestamp;
                }

                if (checkResult.passCriteria) {
                    Object.values(checkResult.passCriteria).forEach(pcResult => {
                        if (pcResult.timestamp) {
                            if (!maxTime || pcResult.timestamp > maxTime) maxTime = pcResult.timestamp;
                        }
                    });
                }
            });
        });
    });

    return maxTime;
}

/**
 * Jämför två kravresultat för persistens: ignorerar `lastStatusUpdate` och `lastStatusUpdateBy`
 * så att oförändrat innehåll inte räknas som ny aktivitet ("Senast uppdaterad").
 * @param {object|null|undefined} a
 * @param {object|null|undefined} b
 * @returns {boolean}
 */
export function requirement_results_equal_for_last_updated(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    let ca;
    let cb;
    try {
        ca = JSON.parse(JSON.stringify(a));
        cb = JSON.parse(JSON.stringify(b));
    } catch {
        return false;
    }
    delete ca.lastStatusUpdate;
    delete ca.lastStatusUpdateBy;
    delete cb.lastStatusUpdate;
    delete cb.lastStatusUpdateBy;
    return JSON.stringify(ca) === JSON.stringify(cb);
}

/**
 * Beräknar senaste aktivitetstid från observationer och `auditLastNonObservationActivityAt`
 * (används vid snapshot; påverkas inte av fryst visningsvärde).
 * @param {Object} audit_state
 * @returns {string|null}
 */
export function compute_audit_last_updated_live_timestamp(audit_state) {
    if (!audit_state) return null;
    const from_samples = get_last_activity_timestamp(audit_state);
    const from_non_obs = audit_state.auditLastNonObservationActivityAt || null;
    if (!from_samples && !from_non_obs) return null;
    if (!from_samples) return from_non_obs;
    if (!from_non_obs) return from_samples;
    return from_samples > from_non_obs ? from_samples : from_non_obs;
}

/**
 * Senaste ISO-tid för visning i översikt/export. För låst eller arkiverad granskning
 * returneras alltid `auditLastUpdatedAtFrozen` om det finns (sätts vid låsning).
 * @param {Object} audit_state
 * @returns {string|null}
 */
export function get_audit_last_updated_display_timestamp(audit_state) {
    if (!audit_state) return null;
    if ((audit_state.auditStatus === 'locked' || audit_state.auditStatus === 'archived')
        && audit_state.auditLastUpdatedAtFrozen) {
        return audit_state.auditLastUpdatedAtFrozen;
    }
    return compute_audit_last_updated_live_timestamp(audit_state);
}

/**
 * Counts total number of attached images/media across all samples.
 * Each filename in attachedMediaFilenames counts as one.
 */
export function count_attached_images(state) {
    if (!state?.samples) return 0;
    let count = 0;
    (state.samples || []).forEach(sample => {
        Object.values(sample.requirementResults || {}).forEach(reqResult => {
            Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                Object.values(checkResult.passCriteria || {}).forEach(pcResult => {
                    const filenames = pcResult.attachedMediaFilenames;
                    if (Array.isArray(filenames)) {
                        count += filenames.length;
                    }
                });
            });
        });
    });
    return count;
}

/**
 * Counts number of control points (places) where media has been attached.
 * Each unique sample+requirement+check+passCriterion combination with at least one attached file counts as one.
 */
export function count_attached_media_places(state) {
    if (!state?.samples) return 0;
    let count = 0;
    (state.samples || []).forEach(sample => {
        Object.values(sample.requirementResults || {}).forEach(reqResult => {
            Object.values(reqResult.checkResults || {}).forEach(checkResult => {
                Object.values(checkResult.passCriteria || {}).forEach(pcResult => {
                    const filenames = pcResult?.attachedMediaFilenames;
                    if (Array.isArray(filenames) && filenames.some(f => f && String(f).trim())) {
                        count += 1;
                    }
                });
            });
        });
    });
    return count;
}

/**
 * Collects all "problems" (requirements where user wrote text under "Jag har kört fast").
 * Returns array of { requirement, sample, reqId, stuck_text }.
 */
function find_requirement_by_id(requirements, reqId) {
    if (!requirements || reqId === null || reqId === undefined) return null;
    const reqIdStr = String(reqId);
    if (Array.isArray(requirements)) {
        return requirements.find((r) => {
            const k = r?.key !== null && r?.key !== undefined ? String(r.key) : null;
            const i = r?.id !== null && r?.id !== undefined ? String(r.id) : null;
            return (k !== null && k === reqIdStr) || (i !== null && i === reqIdStr);
        }) || null;
    }
    const direct = requirements[reqId] ?? requirements[reqIdStr];
    if (direct) return direct;
    // Fallback: leta efter match via req.key / req.id när uppslagningen inte är lika med map-nyckeln.
    for (const value of Object.values(requirements)) {
        const k = value?.key !== null && value?.key !== undefined ? String(value.key) : null;
        const i = value?.id !== null && value?.id !== undefined ? String(value.id) : null;
        if ((k !== null && k === reqIdStr) || (i !== null && i === reqIdStr)) return value;
    }
    return null;
}

/**
 * Slår upp ett krav via både map-nyckel, req.key och req.id. Tolerant mot skillnader mellan
 * data-requirement-id (vanligen req.key) och faktisk nyckel i ruleFileContent.requirements.
 * @param {object|Array|null|undefined} requirements
 * @param {string|number|null|undefined} reqId
 * @returns {object|null}
 */
export function find_requirement_definition(requirements, reqId) {
    return find_requirement_by_id(requirements, reqId);
}

/**
 * Returnerar map-nyckeln i ruleFileContent.requirements för ett givet reqId (som kan vara map-nyckel,
 * req.key eller req.id). Returnerar null om inget matchar eller om requirements är en array.
 * @param {object|Array|null|undefined} requirements
 * @param {string|number|null|undefined} reqId
 * @returns {string|null}
 */
export function resolve_requirement_map_key(requirements, reqId) {
    if (!requirements || Array.isArray(requirements) || reqId === null || reqId === undefined) return null;
    const reqIdStr = String(reqId);
    if (Object.prototype.hasOwnProperty.call(requirements, reqIdStr)) return reqIdStr;
    for (const [key, value] of Object.entries(requirements)) {
        const k = value?.key !== null && value?.key !== undefined ? String(value.key) : null;
        const i = value?.id !== null && value?.id !== undefined ? String(value.id) : null;
        if ((k !== null && k === reqIdStr) || (i !== null && i === reqIdStr)) return key;
    }
    return null;
}

/**
 * Hämtar lagrat kravresultat med samma uppslagning som granskningsvyn: försöker map-nyckel först,
 * därefter reserv (publikt id) om resultatet sparats under en äldre nyckel.
 * @param {Record<string, object>|null|undefined} requirement_results
 * @param {object|Array|null|undefined} requirements ruleFileContent.requirements
 * @param {object} req_def
 * @param {string|number|null|undefined} [entry_map_key] Nyckel från t.ex. Object.entries
 * @returns {object|undefined}
 */
export function get_stored_requirement_result_for_def(
    requirement_results,
    requirements,
    req_def,
    entry_map_key
) {
    if (!requirement_results || !req_def || typeof requirement_results !== 'object') {
        return undefined;
    }
    const try_keys = [];
    const add = (k) => {
        if (k === null || k === undefined) return;
        const s = String(k).trim();
        if (s === '' || try_keys.includes(s)) return;
        try_keys.push(s);
    };
    add(resolve_requirement_map_key(requirements, req_def.key));
    add(resolve_requirement_map_key(requirements, req_def.id));
    if (requirements && !Array.isArray(requirements) && entry_map_key != null) {
        const em = String(entry_map_key);
        if (Object.prototype.hasOwnProperty.call(requirements, em)) {
            add(em);
        }
        add(resolve_requirement_map_key(requirements, em));
    }
    add(req_def.key);
    add(req_def.id);
    if (entry_map_key != null) {
        add(entry_map_key);
    }
    for (const k of try_keys) {
        if (Object.prototype.hasOwnProperty.call(requirement_results, k) && requirement_results[k] != null) {
            return requirement_results[k];
        }
    }
    return undefined;
}

/**
 * Returnerar den publika kravnyckeln (key-etiketten) för en given intern map-nyckel.
 * Om key saknas faller den tillbaka till map-nyckeln.
 * @param {object|Array|null|undefined} requirements
 * @param {string|number|null|undefined} map_key
 * @returns {string|null}
 */
export function get_requirement_public_key(requirements, map_key) {
    if (!requirements || map_key === null || map_key === undefined) return null;
    const mapKeyStr = String(map_key);
    if (Array.isArray(requirements)) {
        const req = requirements.find(r => String(r?.key || r?.id || '') === mapKeyStr) || null;
        const pub = req?.key ?? req?.id ?? null;
        return pub !== null && pub !== undefined && String(pub).trim() !== '' ? String(pub) : mapKeyStr;
    }
    const req = requirements?.[mapKeyStr] || null;
    const pub = req?.key ?? req?.id ?? null;
    return pub !== null && pub !== undefined && String(pub).trim() !== '' ? String(pub) : mapKeyStr;
}

export function collect_audit_problems(state) {
    if (!state?.samples || !state?.ruleFileContent?.requirements) return [];
    const problems = [];
    const requirements = state.ruleFileContent.requirements;

    (state.samples || []).forEach(sample => {
        Object.entries(sample.requirementResults || {}).forEach(([reqId, reqResult]) => {
            const stuck_text = (reqResult?.stuckProblemDescription || '').trim();
            if (!stuck_text) return;

            const requirement = find_requirement_by_id(requirements, reqId) || { id: reqId, key: reqId, title: String(reqId) };

            problems.push({
                requirement,
                sample,
                reqId,
                stuck_text,
                lastStatusUpdate: reqResult?.lastStatusUpdate || null
            });
        });
    });
    problems.sort((a, b) => {
        const ta = a.lastStatusUpdate || '';
        const tb = b.lastStatusUpdate || '';
        return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    return problems;
}

/**
 * Counts total number of problems (requirements with stuck text).
 */
export function count_audit_problems(state) {
    return collect_audit_problems(state).length;
}

/**
 * Returns true if the requirement result has "behöver hjälp" – sätts automatiskt när
 * användaren fyllt i text i "Jag har kört fast" (stuckProblemDescription).
 */
export function requirement_needs_help(req_result) {
    return ((req_result?.stuckProblemDescription || '').trim()) !== '';
}

/**
 * Bygger ett komplett "passed" (Ingen anmärkning) requirement result utifrån kravdefinitionen.
 * @param {object} requirement_definition - Kravdefinitionen från regelfilen
 * @param {object} [existing_result] - Befintligt resultat (bevarar commentToAuditor, commentToActor)
 * @param {string} timestamp - ISO-datumsträng för timestamps
 * @param {string} [updatedBy] - Namn på användaren som gjorde ändringen
 * @returns {object} Ett requirement result med alla checks och pass criteria satta till passed
 */
export function build_passed_requirement_result(requirement_definition, existing_result, timestamp, updatedBy) {
    const checks = requirement_definition?.checks || [];
    const checkResults = {};

    checks.forEach(check_def => {
        const passCriteria = {};
        (check_def.passCriteria || []).forEach(pc_def => {
            const pc = {
                status: 'passed',
                observationDetail: '',
                timestamp: timestamp,
                attachedMediaFilenames: []
            };
            if (updatedBy) pc.updatedBy = updatedBy;
            passCriteria[pc_def.id] = pc;
        });
        checkResults[check_def.id] = {
            status: 'passed',
            overallStatus: 'passed',
            passCriteria
        };
    });

    const result = {
        status: 'passed',
        commentToAuditor: (existing_result?.commentToAuditor !== undefined) ? existing_result.commentToAuditor : '',
        commentToActor: (existing_result?.commentToActor !== undefined) ? existing_result.commentToActor : '',
        lastStatusUpdate: timestamp,
        stuckProblemDescription: (existing_result?.stuckProblemDescription !== undefined) ? existing_result.stuckProblemDescription : '',
        checkResults
    };
    if (updatedBy) result.lastStatusUpdateBy = updatedBy;
    return result;
}

/**
 * Bygger ett requirement result där alla kontrollpunkter sätts till "Stämmer inte" (not_applicable).
 * Används för "Markera alla icke-granskade som Ingen anmärkning". Raderar bifogade bilder och "Jag har kört fast".
 * @param {object} requirement_definition - Kravdefinitionen från regelfilen
 * @param {object} [existing_result] - Befintligt resultat (bevarar commentToAuditor, commentToActor)
 * @param {string} timestamp - ISO-datumsträng för timestamps
 * @param {string} [updatedBy] - Namn på användaren som gjorde ändringen
 * @returns {object} Ett requirement result med alla checks satta till not_applicable, kravet blir "passed"
 */
export function build_not_applicable_requirement_result(requirement_definition, existing_result, timestamp, updatedBy) {
    const checks = requirement_definition?.checks || [];
    const checkResults = {};

    checks.forEach(check_def => {
        const passCriteria = {};
        (check_def.passCriteria || []).forEach(pc_def => {
            const pc = {
                status: 'passed',
                observationDetail: '',
                timestamp: timestamp,
                attachedMediaFilenames: []
            };
            if (updatedBy) pc.updatedBy = updatedBy;
            passCriteria[pc_def.id] = pc;
        });
        checkResults[check_def.id] = {
            status: 'passed',
            overallStatus: 'not_applicable',
            passCriteria
        };
    });

    const result = {
        status: 'passed',
        commentToAuditor: (existing_result?.commentToAuditor !== undefined) ? existing_result.commentToAuditor : '',
        commentToActor: (existing_result?.commentToActor !== undefined) ? existing_result.commentToActor : '',
        lastStatusUpdate: timestamp,
        stuckProblemDescription: '',
        checkResults
    };
    if (updatedBy) result.lastStatusUpdateBy = updatedBy;
    return result;
}

/**
 * Collects all attached images with context (requirement, sample, check, pc).
 */
export function collect_attached_images(state) {
    if (!state?.samples || !state?.ruleFileContent?.requirements) return [];
    const images = [];
    const requirements = state.ruleFileContent.requirements;

    (state.samples || []).forEach(sample => {
        Object.entries(sample.requirementResults || {}).forEach(([reqId, reqResult]) => {
            const requirement = (Array.isArray(requirements) ? requirements.find(r => (r?.key || r?.id) === reqId) : requirements[reqId]) || null;
            if (!requirement) return;

            const checks_arr = requirement.checks || [];
            Object.entries(reqResult.checkResults || {}).forEach(([checkId, checkResult]) => {
                const check_def = checks_arr.find(c => (c?.id || c?.key) === checkId);
                const check_index = check_def ? checks_arr.indexOf(check_def) : -1;
                const pc_arr = check_def?.passCriteria || [];
                Object.entries(checkResult.passCriteria || {}).forEach(([pcId, pcResult]) => {
                    const filenames = pcResult?.attachedMediaFilenames;
                    if (!Array.isArray(filenames) || filenames.length === 0) return;
                    const pc_def = pc_arr.find(p => (p?.id || p?.key) === pcId) || {};
                    const pc_index = pc_arr.indexOf(pc_def);
                    filenames.forEach(filename => {
                        if (filename && String(filename).trim()) {
                            images.push({
                                requirement,
                                sample,
                                reqId,
                                checkId,
                                pcId,
                                check_def: check_def || null,
                                pc_def,
                                check_index,
                                pc_index,
                                filename: String(filename).trim()
                            });
                        }
                    });
                });
            });
        });
    });
    return images;
}