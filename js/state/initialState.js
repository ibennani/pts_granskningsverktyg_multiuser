// js/state/initialState.js

export const APP_STATE_VERSION = '2.1.0';

export const initial_state = {
    saveFileVersion: APP_STATE_VERSION,
    ruleFileContent: null,
    ruleFileIsPublished: false,
    auditMetadata: {
        caseNumber: '',
        actorName: '',
        actorLink: '',
        auditorName: '',
        caseHandler: '',
        internalComment: ''
    },
    auditStatus: 'not_started',
    startTime: null,
    endTime: null,
    auditLastNonObservationActivityAt: null,
    /** ISO-tid för "Senast uppdaterad" fryst vid låsning/arkivering; ändras inte efteråt. */
    auditLastUpdatedAtFrozen: null,
    samples: [],
    archivedRequirementResults: [],
    deficiencyCounter: 1,
    ruleFileOriginalContentString: null,
    ruleFileOriginalFilename: '',
    uiSettings: {
        requirementListFilter: {
            searchText: '',
            sortBy: 'default',
            status: { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
        },
        allRequirementsFilter: {
            searchText: '',
            sortBy: 'default',
            status: { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
        },
        requirementAuditSidebar: {
            selectedMode: 'requirement_samples',
            filtersByMode: {
                sample_requirements: {
                    searchText: '',
                    sortBy: 'ref_asc',
                    status: { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
                },
                requirement_samples: {
                    searchText: '',
                    sortBy: 'creation_order',
                    status: { needs_help: true, passed: true, failed: true, partially_audited: true, not_audited: true, updated: true }
                }
            }
        }
    },
    auditCalculations: {},
    pendingSampleChanges: null,
    sampleEditDraft: null,
    manageUsersText: ''
};
