/**
 * @fileoverview Mappar app-state till API-payload för granskningssynk (PATCH / import).
 */

const SERVER_STATUS_VALUES = ['not_started', 'in_progress', 'locked', 'archived'] as const;

export type ServerAuditStatus = (typeof SERVER_STATUS_VALUES)[number];

/** Minsta state som state_to_patch / state_to_import behöver. */
export type SyncPayloadState = {
    auditId?: string;
    ruleSetId?: string | null;
    auditMetadata?: Record<string, unknown> & { audit_edit_log?: unknown[] };
    auditStatus?: string;
    samples?: unknown[];
    version?: number | string | null;
    ruleFileContent?: unknown;
    archivedRequirementResults?: unknown[];
};

export type AuditPatchPayload = {
    metadata: Record<string, unknown>;
    status: ServerAuditStatus;
    samples: unknown[];
    expectedVersion: number;
    ruleFileContent?: unknown;
    archivedRequirementResults?: unknown[];
};

export type AuditImportPayload = {
    ruleFileContent: unknown | undefined;
    auditMetadata: Record<string, unknown>;
    auditStatus: ServerAuditStatus;
    samples: unknown[];
};

export function normalize_status_for_server(status: string | undefined): ServerAuditStatus {
    if (status && (SERVER_STATUS_VALUES as readonly string[]).includes(status)) {
        return status as ServerAuditStatus;
    }
    return 'not_started';
}

export type StateToPatchOptions = {
    /** Om false utelämnas ruleFileContent (server behåller befintlig regelfil). */
    include_rule_file_content?: boolean;
};

export function state_to_patch(state: SyncPayloadState, options: StateToPatchOptions = {}): AuditPatchPayload {
    const include_rule =
        options.include_rule_file_content !== false && Boolean(state.ruleFileContent);
    const patch: AuditPatchPayload = {
        metadata: (state.auditMetadata || {}) as Record<string, unknown>,
        status: normalize_status_for_server(state.auditStatus || 'not_started'),
        samples: state.samples || [],
        expectedVersion:
            state.version !== null && state.version !== undefined && state.version !== ''
                ? Number(state.version)
                : 0
    };
    if (include_rule && state.ruleFileContent) {
        patch.ruleFileContent = state.ruleFileContent;
    }
    if (Array.isArray(state.archivedRequirementResults)) {
        patch.archivedRequirementResults = state.archivedRequirementResults;
    }
    return patch;
}

/** PATCH med endast metadata och status (inga stickprov eller regelfil). */
export type AuditMetadataPatchPayload = {
    metadata: Record<string, unknown>;
    status: ServerAuditStatus;
    expectedVersion: number;
};

export function state_to_metadata_patch(state: SyncPayloadState): AuditMetadataPatchPayload {
    return {
        metadata: (state.auditMetadata || {}) as Record<string, unknown>,
        status: normalize_status_for_server(state.auditStatus || 'not_started'),
        expectedVersion:
            state.version !== null && state.version !== undefined && state.version !== ''
                ? Number(state.version)
                : 0
    };
}

export function state_to_import(state: SyncPayloadState): AuditImportPayload {
    return {
        ruleFileContent: state.ruleFileContent,
        auditMetadata: (state.auditMetadata || {}) as Record<string, unknown>,
        auditStatus: normalize_status_for_server(state.auditStatus || 'not_started'),
        samples: state.samples || []
    };
}
