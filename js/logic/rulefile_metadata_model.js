/**
 * Kloning och normalisering av regelfilsmetadata (vocabularies, stickprov m.m.).
 * @module js/logic/rulefile_metadata_model
 */

/**
 * Djup kloning av metadata-objekt.
 * @param {object|undefined|null} metadata
 * @returns {object}
 */
export function clone_metadata(metadata) {
    return JSON.parse(JSON.stringify(metadata || {}));
}

/**
 * Säkerställer monitoringType, vocabularies och bakåtkompatibla fält.
 * Muterar och returnerar samma objekt.
 * @param {object} workingMetadata
 * @returns {object}
 */
export function ensure_metadata_defaults(workingMetadata) {
    if (!workingMetadata.monitoringType) {
        workingMetadata.monitoringType = { type: '', text: '' };
    } else {
        workingMetadata.monitoringType.type = workingMetadata.monitoringType.type || '';
        workingMetadata.monitoringType.text = workingMetadata.monitoringType.text || '';
    }

    // Support both old format (direct) and new format (vocabularies)
    if (!workingMetadata.vocabularies) {
        // Migrate to new format if needed
        workingMetadata.vocabularies = {};
        if (workingMetadata.pageTypes) {
            workingMetadata.vocabularies.pageTypes = Array.isArray(workingMetadata.pageTypes) ? [...workingMetadata.pageTypes] : [];
        }
        if (workingMetadata.contentTypes) {
            workingMetadata.vocabularies.contentTypes = Array.isArray(workingMetadata.contentTypes) ? [...workingMetadata.contentTypes] : [];
        }
        if (workingMetadata.taxonomies) {
            workingMetadata.vocabularies.taxonomies = Array.isArray(workingMetadata.taxonomies) ? [...workingMetadata.taxonomies] : [];
        }
        // Handle sampleTypes - can be either an object with sampleCategories or an array
        if (workingMetadata.samples?.sampleTypes) {
            if (typeof workingMetadata.samples.sampleTypes === 'object' && !Array.isArray(workingMetadata.samples.sampleTypes)) {
                // New format: object with sampleCategories and sampleTypes array
                workingMetadata.vocabularies.sampleTypes = {
                    sampleCategories: Array.isArray(workingMetadata.samples.sampleTypes.sampleCategories)
                        ? [...workingMetadata.samples.sampleTypes.sampleCategories]
                        : [],
                    sampleTypes: Array.isArray(workingMetadata.samples.sampleTypes.sampleTypes)
                        ? [...workingMetadata.samples.sampleTypes.sampleTypes]
                        : []
                };
            } else if (Array.isArray(workingMetadata.samples.sampleTypes)) {
                // Old format: just an array
                workingMetadata.vocabularies.sampleTypes = {
                    sampleCategories: [],
                    sampleTypes: [...workingMetadata.samples.sampleTypes]
                };
            } else {
                workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
            }
        } else {
            workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
        }
    }

    // Ensure vocabularies structure exists
    if (!workingMetadata.vocabularies.pageTypes) {
        workingMetadata.vocabularies.pageTypes = Array.isArray(workingMetadata.pageTypes) ? [...workingMetadata.pageTypes] : [];
    }
    if (!workingMetadata.vocabularies.contentTypes) {
        workingMetadata.vocabularies.contentTypes = Array.isArray(workingMetadata.contentTypes) ? [...workingMetadata.contentTypes] : [];
    }
    if (!workingMetadata.vocabularies.taxonomies) {
        workingMetadata.vocabularies.taxonomies = Array.isArray(workingMetadata.taxonomies) ? [...workingMetadata.taxonomies] : [];
    }
    if (!workingMetadata.vocabularies.sampleTypes) {
        workingMetadata.vocabularies.sampleTypes = { sampleCategories: [], sampleTypes: [] };
    }

    // Ensure sampleTypes is an object with both properties
    if (typeof workingMetadata.vocabularies.sampleTypes !== 'object' || Array.isArray(workingMetadata.vocabularies.sampleTypes)) {
        workingMetadata.vocabularies.sampleTypes = {
            sampleCategories: [],
            sampleTypes: Array.isArray(workingMetadata.vocabularies.sampleTypes) ? [...workingMetadata.vocabularies.sampleTypes] : []
        };
    }
    if (!Array.isArray(workingMetadata.vocabularies.sampleTypes.sampleCategories)) {
        workingMetadata.vocabularies.sampleTypes.sampleCategories = [];
    }
    if (!Array.isArray(workingMetadata.vocabularies.sampleTypes.sampleTypes)) {
        workingMetadata.vocabularies.sampleTypes.sampleTypes = [];
    }

    // Backward compatibility: also set direct properties
    workingMetadata.pageTypes = workingMetadata.vocabularies.pageTypes;
    workingMetadata.contentTypes = workingMetadata.vocabularies.contentTypes;
    workingMetadata.taxonomies = workingMetadata.vocabularies.taxonomies;

    if (!workingMetadata.samples) {
        workingMetadata.samples = { sampleCategories: [], sampleTypes: [] };
    }
    // Set sampleCategories from vocabularies
    workingMetadata.samples.sampleCategories = Array.isArray(workingMetadata.vocabularies.sampleTypes.sampleCategories)
        ? [...workingMetadata.vocabularies.sampleTypes.sampleCategories]
        : [];
    // Set sampleTypes array from vocabularies.sampleTypes.sampleTypes
    workingMetadata.samples.sampleTypes = Array.isArray(workingMetadata.vocabularies.sampleTypes.sampleTypes)
        ? [...workingMetadata.vocabularies.sampleTypes.sampleTypes]
        : [];
    workingMetadata.keywords = Array.isArray(workingMetadata.keywords) ? [...workingMetadata.keywords] : [];
    return workingMetadata;
}
