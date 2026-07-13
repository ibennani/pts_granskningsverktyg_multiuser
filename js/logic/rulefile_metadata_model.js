/**
 * Kloning och normalisering av regelfilsmetadata (vocabularies, stickprov m.m.).
 * @module js/logic/rulefile_metadata_model
 */

import { normalize_rulefile_metadata_vocabularies } from '../../shared/rulefile/rulefile_metadata_vocabularies.js';

/**
 * Djup kloning av metadata-objekt.
 * @param {object|undefined|null} metadata
 * @returns {object}
 */
export function clone_metadata(metadata) {
    return JSON.parse(JSON.stringify(metadata || {}));
}

/**
 * Säkerställer monitoringType och kanoniska vocabulary-fält för regelfilsredigering.
 * Muterar och returnerar samma objekt. Använd inte på inbäddad ruleFileContent i granskningar.
 * @param {object} workingMetadata
 * @returns {object}
 */
export function ensure_metadata_defaults(workingMetadata) {
    const normalized = normalize_rulefile_metadata_vocabularies(workingMetadata, { mode: 'read' });
    Object.keys(workingMetadata).forEach((key) => {
        delete workingMetadata[key];
    });
    Object.assign(workingMetadata, normalized);

    if (!workingMetadata.monitoringType) {
        workingMetadata.monitoringType = { type: '', text: '' };
    } else {
        workingMetadata.monitoringType.type = workingMetadata.monitoringType.type || '';
        workingMetadata.monitoringType.text = workingMetadata.monitoringType.text || '';
    }

    workingMetadata.keywords = Array.isArray(workingMetadata.keywords) ? [...workingMetadata.keywords] : [];
    return workingMetadata;
}
