// js/audit_logic.js

function get_t_func() {
    return (typeof window.Translation !== 'undefined' && typeof window.Translation.t === 'function')
        ? window.Translation.t
        : (key, replacements) => `**${key}**`;
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
    console.log("[AuditLogic] Removing all deficiency IDs...");
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
    console.log("[AuditLogic] Running assignSortedDeficiencyIdsOnLock...");
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
            const reqDef = newState.ruleFileContent.requirements[reqKey];
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
        const has_failed = pc_statuses.some(s => s === 'failed');
        const has_not_audited = pc_statuses.some(s => s === 'not_audited');
        const all_not_audited = pc_statuses.every(s => s === 'not_audited');
        const all_audited_and_failed = !pc_statuses.some(s => s === 'not_audited') && !has_passed;
        
        if (has_passed) return "passed";
        if (all_not_audited) return "not_audited";
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
        let has_failed_check = false, has_partially_audited_check = false, has_not_audited_check = false;
        
        for (const check_definition of requirement_object.checks) {
            // Validera check_definition
            if (!check_definition || typeof check_definition !== 'object' || !check_definition.id) {
                console.warn('[AuditLogic] calculate_requirement_status: Invalid check_definition:', check_definition);
                has_not_audited_check = true;
                continue;
            }
            
            const checkResultForDef = requirement_result_object.checkResults[check_definition.id];
            let status = 'not_audited';
            
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
        if (has_partially_audited_check) return "partially_audited";
        if (has_not_audited_check) return "not_audited";
        return "passed";
    } catch (error) {
        console.error('[AuditLogic] calculate_requirement_status: Error processing requirement:', error);
        return "not_audited";
    }
}

export function get_relevant_requirements_for_sample(rule_file_content, sample) {
    // Förbättrad null-säkerhet och validering
    if (!rule_file_content || typeof rule_file_content !== 'object') {
        console.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid rule_file_content');
        return [];
    }
    
    if (!rule_file_content.requirements || typeof rule_file_content.requirements !== 'object') {
        console.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid or missing requirements object');
        return [];
    }
    
    if (!sample || typeof sample !== 'object') {
        console.warn('[AuditLogic] get_relevant_requirements_for_sample: Invalid sample object');
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
        console.error('[AuditLogic] get_relevant_requirements_for_sample: Error processing requirements:', error);
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
            if (ref_a && ref_b) return window.Helpers.natural_sort(ref_a, ref_b);
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
            const status = calculate_requirement_status(req_def, sample.requirementResults?.[req_def.key || req_def.id]);
            if (status === 'passed' || status === 'failed') {
                total_completed_assessments++;
            }
        });
    });

    return { audited: total_completed_assessments, total: total_possible_assessments };
}


export function find_first_incomplete_requirement_key_for_sample(rule_file_content, sample_object, exclude_key = null) {
    if (!sample_object || !rule_file_content?.requirements) return null;
    const ordered_keys = get_ordered_relevant_requirement_keys(rule_file_content, sample_object, 'default');
    for (const req_key of ordered_keys) {
        if (exclude_key && req_key === exclude_key) continue; // Hoppa över det aktuella kravet
        const req_def = rule_file_content.requirements[req_key];
        if (!req_def) continue;
        const status = calculate_requirement_status(req_def, sample_object.requirementResults?.[req_key]);
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
        Object.keys(sample.requirementResults || {}).forEach(reqKey => {
            const reqResult = sample.requirementResults[reqKey];
            const reqDef = newState.ruleFileContent.requirements[reqKey];
            if (!reqDef || !reqResult || !reqResult.checkResults) return;

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

    // Om granskningen är låst, beräkna om bristindex baserat på korrekta statusar
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