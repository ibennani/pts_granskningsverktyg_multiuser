/**
 * @fileoverview Avgör om en gransknings-PATCH innebär meningsfull innehållsändring
 * (allt utom audit_edit_log i metadata) för styrning av updated_at.
 */

import { isDeepStrictEqual } from 'node:util';
import {
    type AuditRowMeaningfulSource
} from '../schemas/audit_db_rows.js';
import { type AuditPatchBodySlice } from '../schemas/audit_patch.js';

export type { AuditPatchBodySlice, AuditRowMeaningfulSource };

const NON_MEANINGFUL_METADATA_KEYS = new Set([
    'audit_edit_log',
    'userLastRequirementResumeByUser',
    'lastInProgressActivityAt',
    'last_server_sync_at',
    'last_local_change_at',
    'skip_render'
]);

function parse_json_if_string<T>(value: unknown): T | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
    return value as T;
}

function normalize_metadata_for_compare(metadata: unknown): Record<string, unknown> {
    const parsed = parse_json_if_string<Record<string, unknown>>(metadata);
    const base =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? { ...parsed }
            : {};
    for (const key of NON_MEANINGFUL_METADATA_KEYS) {
        delete base[key];
    }
    return base;
}

function normalize_samples_for_compare(rawSamples: unknown): unknown {
    const parsed = parse_json_if_string<unknown>(rawSamples);
    if (!Array.isArray(parsed)) {
        return parsed === null || parsed === undefined ? null : parsed;
    }

    return parsed.map((s) => {
        if (!s || typeof s !== 'object' || Array.isArray(s)) return s;
        const sampleCopy = { ...(s as Record<string, unknown>) };
        delete sampleCopy.skip_render;

        if (!Array.isArray(sampleCopy.attachedMediaFilenames) || sampleCopy.attachedMediaFilenames.length === 0) {
            delete sampleCopy.attachedMediaFilenames;
        }
        if (sampleCopy.urlAutoScreenshotFilename === null || sampleCopy.urlAutoScreenshotFilename === undefined || sampleCopy.urlAutoScreenshotFilename === '') {
            delete sampleCopy.urlAutoScreenshotFilename;
        }
        if (!Array.isArray(sampleCopy.selectedContentTypes) || sampleCopy.selectedContentTypes.length === 0) {
            delete sampleCopy.selectedContentTypes;
        }

        if (sampleCopy.requirementResults && typeof sampleCopy.requirementResults === 'object' && !Array.isArray(sampleCopy.requirementResults)) {
            const reqResultsCopy: Record<string, unknown> = {};
            for (const [reqKey, reqVal] of Object.entries(sampleCopy.requirementResults as Record<string, unknown>)) {
                if (!reqVal || typeof reqVal !== 'object' || Array.isArray(reqVal)) {
                    reqResultsCopy[reqKey] = reqVal;
                    continue;
                }
                const reqValCopy = { ...(reqVal as Record<string, unknown>) };
                delete reqValCopy.skip_render;

                if (reqValCopy.checkResults && typeof reqValCopy.checkResults === 'object' && !Array.isArray(reqValCopy.checkResults)) {
                    const checkResultsCopy: Record<string, unknown> = {};
                    for (const [checkKey, checkVal] of Object.entries(reqValCopy.checkResults as Record<string, unknown>)) {
                        if (!checkVal || typeof checkVal !== 'object' || Array.isArray(checkVal)) {
                            checkResultsCopy[checkKey] = checkVal;
                            continue;
                        }
                        const checkValCopy = { ...(checkVal as Record<string, unknown>) };
                        if (checkValCopy.passCriteria && typeof checkValCopy.passCriteria === 'object' && !Array.isArray(checkValCopy.passCriteria)) {
                            const pcCopy: Record<string, unknown> = {};
                            for (const [pcKey, pcVal] of Object.entries(checkValCopy.passCriteria as Record<string, unknown>)) {
                                if (!pcVal || typeof pcVal !== 'object' || Array.isArray(pcVal)) {
                                    pcCopy[pcKey] = pcVal;
                                    continue;
                                }
                                const pcValCopy = { ...(pcVal as Record<string, unknown>) };
                                if (!Array.isArray(pcValCopy.attachedMediaFilenames) || pcValCopy.attachedMediaFilenames.length === 0) {
                                    delete pcValCopy.attachedMediaFilenames;
                                }
                                if (pcValCopy.observationDetail === '' || pcValCopy.observationDetail === null) {
                                    delete pcValCopy.observationDetail;
                                }
                                pcCopy[pcKey] = pcValCopy;
                            }
                            checkValCopy.passCriteria = pcCopy;
                        }
                        checkResultsCopy[checkKey] = checkValCopy;
                    }
                    reqValCopy.checkResults = checkResultsCopy;
                }
                reqResultsCopy[reqKey] = reqValCopy;
            }
            sampleCopy.requirementResults = reqResultsCopy;
        }

        return sampleCopy;
    });
}

function normalize_json_value(value: unknown): unknown {
    const parsed = parse_json_if_string(value);
    return parsed === null || parsed === undefined ? null : parsed;
}

/**
 * Normaliserade fält som ska jämföras (metadata utan audit_edit_log).
 */
export function meaningful_audit_content_slice(row: AuditRowMeaningfulSource): {
    metadata: Record<string, unknown>;
    status: string | null;
    samples: unknown;
    rule_file_content: unknown;
    archived_requirement_results: unknown;
    last_rulefile_update_log: unknown;
} {
    return {
        metadata: normalize_metadata_for_compare(row.metadata),
        status: row.status === null || row.status === undefined ? null : String(row.status),
        samples: normalize_samples_for_compare(row.samples),
        rule_file_content: normalize_json_value(row.rule_file_content),
        archived_requirement_results: normalize_json_value(row.archived_requirement_results),
        last_rulefile_update_log: normalize_json_value(row.last_rulefile_update_log)
    };
}

/**
 * Slår ihop befintlig rad med fält som PATCH uttryckligen skickar.
 */
export function merge_audit_patch_into_row(
    current: AuditRowMeaningfulSource,
    patch: AuditPatchBodySlice
): AuditRowMeaningfulSource {
    return {
        metadata: patch.metadata !== undefined ? patch.metadata : current.metadata,
        status: patch.status !== undefined ? patch.status : current.status,
        samples: patch.samples !== undefined ? patch.samples : current.samples,
        rule_file_content:
            patch.ruleFileContent !== undefined ? patch.ruleFileContent : current.rule_file_content,
        archived_requirement_results:
            patch.archivedRequirementResults !== undefined
                ? patch.archivedRequirementResults
                : current.archived_requirement_results,
        last_rulefile_update_log:
            patch.lastRulefileUpdateLog !== undefined
                ? patch.lastRulefileUpdateLog
                : current.last_rulefile_update_log
    };
}

/**
 * True om något meningsfullt (exkl. enbart audit_edit_log) ändrats efter merge.
 */
export function has_meaningful_audit_patch_change(
    before_row: AuditRowMeaningfulSource,
    patch: AuditPatchBodySlice
): boolean {
    const after_row = merge_audit_patch_into_row(before_row, patch);
    const before_slice = meaningful_audit_content_slice(before_row);
    const after_slice = meaningful_audit_content_slice(after_row);
    return !isDeepStrictEqual(before_slice, after_slice);
}
