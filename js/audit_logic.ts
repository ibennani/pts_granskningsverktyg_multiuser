/**
 * @fileoverview Fasad för granskningslogik; implementation i js/logic/audit_logic_*.ts.
 */

export type {
    AuditStateShape,
    CheckDef,
    CheckResultStored,
    PassCriterionDef,
    PassCriterionStatusMapVal,
    PassCriterionStored,
    RequirementDef,
    RequirementResultStored,
    RuleFileForAudit,
    SampleStored
} from './logic/audit_logic_types.js';

export {
    find_requirement_definition,
    get_requirement_public_key,
    get_stored_requirement_result_for_def,
    resolve_requirement_map_key
} from './logic/audit_logic_lookup.js';

export {
    calculate_check_status,
    calculate_requirement_status,
    get_effective_requirement_audit_status
} from './logic/audit_logic_status.js';

export {
    assignSortedDeficiencyIdsOnLock,
    formatDeficiencyId,
    removeAllDeficiencyIds,
    updateIncrementalDeficiencyIds
} from './logic/audit_logic_deficiency.js';

export { get_ordered_relevant_requirement_keys, get_relevant_requirements_for_sample } from './logic/audit_logic_requirements_lists.js';

export {
    calculate_overall_audit_progress,
    calculate_overall_audit_status_counts,
    calculate_sample_requirement_status_counts,
    count_requirements_needing_review_in_audit,
    find_first_incomplete_requirement_key_for_sample,
    sample_has_any_requirement_needing_review
} from './logic/audit_logic_progress.js';

export {
    compute_audit_last_updated_live_timestamp,
    get_audit_last_updated_display_timestamp,
    get_last_activity_timestamp,
    recalculateAuditTimes,
    recalculateStatusesOnLoad,
    requirement_results_equal_for_last_updated
} from './logic/audit_logic_recalc.js';

export {
    build_not_applicable_requirement_result,
    build_passed_requirement_result,
    collect_attached_images,
    collect_audit_problems,
    count_attached_images,
    count_attached_media_places,
    count_audit_problems,
    requirement_needs_help
} from './logic/audit_logic_problems_media.js';
