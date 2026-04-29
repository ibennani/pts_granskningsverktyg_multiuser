const SERVER_STATUS_VALUES = ['not_started', 'in_progress', 'locked', 'archived'];

export function normalize_status_for_server(status) {
    if (SERVER_STATUS_VALUES.includes(status)) return status;
    return 'not_started';
}

export function state_to_patch(state) {
    const patch = {
        metadata: state.auditMetadata || {},
        status: normalize_status_for_server(state.auditStatus || 'not_started'),
        samples: state.samples || [],
        expectedVersion: state.version !== null && state.version !== undefined && state.version !== '' ? Number(state.version) : 0
    };
    // Inkludera regelfilinnehåll så att "Uppdatera regelfil" och liknande persisteras i audits.rule_file_content
    if (state.ruleFileContent) {
        patch.ruleFileContent = state.ruleFileContent;
    }
    if (Array.isArray(state.archivedRequirementResults)) {
        patch.archivedRequirementResults = state.archivedRequirementResults;
    }
    return patch;
}

export function state_to_import(state) {
    return {
        ruleFileContent: state.ruleFileContent,
        auditMetadata: state.auditMetadata || {},
        auditStatus: normalize_status_for_server(state.auditStatus || 'not_started'),
        samples: state.samples || []
    };
}

