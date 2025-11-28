// js/logic/ScoreCalculator.js
'use-strict';

/**
 * Calculates the weight (omega, ωp) for a single requirement based on its impact.
 * This is a helper function used during score calculation.
 * @param {object} requirement - The requirement object from the rule file.
 * @returns {number} The calculated weight.
 */
function _calculateRequirementWeight(requirement) {
    const impact = requirement?.metadata?.impact;
    if (!impact) return 0;

    const isCriticalFactor = impact.isCritical === true ? 1.0 : 0.9;
    const primaryScore = impact.primaryScore || 0;
    const secondaryScore = impact.secondaryScore || 0;
    
    const scoreComponent = Math.sqrt(primaryScore + (0.5 * secondaryScore));
    
    return isCriticalFactor * scoreComponent;
}

/**
 * Gets all relevant requirements for a given sample based on its content types.
 * @param {object} ruleFileContent - The rule file content from the state.
 * @param {object} sample - The sample object.
 * @returns {Array<object>} An array of relevant requirement objects.
 */
function _getRelevantRequirementsForSample(ruleFileContent, sample) {
    if (!ruleFileContent?.requirements || !sample) return [];
    const all_reqs = Object.values(ruleFileContent.requirements);

    if (!sample.selectedContentTypes?.length) {
        return [];
    }
    
    return all_reqs.filter(req => {
        if (!req.contentType || req.contentType.length === 0) return true;
        return req.contentType.some(ct => sample.selectedContentTypes.includes(ct));
    });
}

/**
 * The main function to calculate the score based on the 0-100 model.
 * NOTE: This function calculates a DEFICIENCY index (0=best, 100=worst)
 * but retains its original name for API compatibility within the app.
 * @param {object} auditState - The complete current audit state.
 * @returns {object|null} An object with totalScore and a breakdown by principle, or null if calculation is not possible.
 */
export function calculateQualityScore(auditState) {
    if (!auditState?.ruleFileContent?.requirements || !auditState.ruleFileContent.metadata?.taxonomies || !auditState.samples?.length) {
        return null; // Not enough data to calculate a score.
    }

    const classifications = auditState.ruleFileContent.metadata.taxonomies.find(tax => tax.id === 'wcag22-pour');
    if (!classifications) return null;

    let totalMaxWeight = 0;
    let totalDeductions = 0;
    
    const principleScores = {};
    classifications.concepts.forEach(c => {
        principleScores[c.id] = { maxWeight: 0, deductions: 0 };
    });

    // 1. Iterate through each sample to calculate contributions.
    auditState.samples.forEach(sample => {
        const relevantReqsForSample = _getRelevantRequirementsForSample(auditState.ruleFileContent, sample);
        
        relevantReqsForSample.forEach(reqDef => {
            const reqKey = reqDef.key || reqDef.id;
            const reqWeight = _calculateRequirementWeight(reqDef);
            
            totalMaxWeight += reqWeight;

            const principleId = reqDef.classifications?.find(c => c.taxonomyId === 'wcag22-pour')?.conceptId;
            if (principleId && principleScores.hasOwnProperty(principleId)) {
                principleScores[principleId].maxWeight += reqWeight;
            }

            const reqResult = sample.requirementResults?.[reqKey];
            let deficiencyPointsForReq = 0;
            if (reqResult?.checkResults) {
                let failureCountForReq = 0;
                Object.values(reqResult.checkResults).forEach(checkResult => {
                    if (checkResult.overallStatus === 'passed' && checkResult.passCriteria) {
                        Object.values(checkResult.passCriteria).forEach(pcResult => {
                            if (pcResult?.status === 'failed') {
                                failureCountForReq++;
                            }
                        });
                    }
                });
                deficiencyPointsForReq = failureCountForReq * reqWeight;
            }

            const adjustedDeductions = Math.min(deficiencyPointsForReq, reqWeight);
            
            totalDeductions += adjustedDeductions;
            if (principleId && principleScores.hasOwnProperty(principleId)) {
                principleScores[principleId].deductions += adjustedDeductions;
            }
        });
    });

    // 2. Calculate the final normalized deficiency indexes
    const finalPrincipleReport = {};
    classifications.concepts.forEach(concept => {
        const id = concept.id;
        const data = principleScores[id];
        // Deficiency Index = (Total Deductions / Max Possible Weight) * 100
        const deficiencyIndex = (data.maxWeight > 0) ? (data.deductions / data.maxWeight) * 100 : 0;
        finalPrincipleReport[id] = {
            label: concept.label,
            score: parseFloat(deficiencyIndex.toFixed(1))
        };
    });

    const finalTotalDeficiencyIndex = (totalMaxWeight > 0) ? (totalDeductions / totalMaxWeight) * 100 : 0;

    return {
        totalScore: parseFloat(finalTotalDeficiencyIndex.toFixed(1)),
        principles: finalPrincipleReport,
        sampleCount: auditState.samples.length
    };
}

console.log("[ScoreCalculator.js] ScoreCalculator loaded.");
