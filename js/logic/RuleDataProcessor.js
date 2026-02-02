// js/logic/RuleDataProcessor.js
'use-strict';

/**
 * Calculates the weight (omega, ωp) for a single requirement based on its impact.
 * This is a helper function used during pre-calculation.
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
 * Pre-calculates and processes the rule file to extract data needed for scoring.
 * This runs once when a rule file is loaded.
 * @param {object} ruleFileContent - The full content of the loaded rule file.
 * @returns {object} An object containing pre-calculated data maps and totals.
 */
export function precalculateRuleData(ruleFileContent) {
    console.log("[RuleDataProcessor] Pre-calculating rule data for scoring...");
    
    const precalculatedData = {
        requirementWeights: {},          // Map of requirement ID to its calculated weight
        principleMaxWeights: {},         // Map of principle ID to its total possible weight
        requirementToPrincipleMap: {}    // Map of requirement ID to its principle ID
    };

    if (!ruleFileContent || !ruleFileContent.requirements || !ruleFileContent.metadata?.taxonomies) {
        console.error("[RuleDataProcessor] Rule file is missing requirements or taxonomies for pre-calculation.");
        return precalculatedData; // Return empty object
    }
    
    const requirements = ruleFileContent.requirements;
    const taxonomies = ruleFileContent.metadata?.vocabularies?.taxonomies || ruleFileContent.metadata?.taxonomies || [];
    const classifications = taxonomies.find(tax => tax.id === 'wcag22-pour');
    
    if (!classifications) {
        console.error("[RuleDataProcessor] 'wcag22-pour' taxonomy not found in rule file.");
        return precalculatedData;
    }

    // Initialize max weight counters for each principle
    classifications.concepts.forEach(c => {
        precalculatedData.principleMaxWeights[c.id] = 0;
    });

    // Iterate over all requirements to calculate their weights and assign them to principles
    for (const reqKey in requirements) {
        const requirement = requirements[reqKey];
        const weight = _calculateRequirementWeight(requirement);

        precalculatedData.requirementWeights[reqKey] = weight;
        
        if (weight > 0 && requirement.classifications) {
            requirement.classifications.forEach(c => {
                if (c.taxonomyId === 'wcag22-pour' && precalculatedData.principleMaxWeights.hasOwnProperty(c.conceptId)) {
                    precalculatedData.principleMaxWeights[c.conceptId] += weight;
                    precalculatedData.requirementToPrincipleMap[reqKey] = c.conceptId;
                }
            });
        }
    }
    
    console.log("[RuleDataProcessor] Pre-calculation complete:", JSON.parse(JSON.stringify(precalculatedData)));
    return precalculatedData;
}

console.log("[RuleDataProcessor.js] RuleDataProcessor loaded.");
