/**
 * @fileoverview Delade typer och host-cast för ChecklistHandler.
 */

import type { ChecklistLockHelpers } from './checklist_event_handler_types.js';
import type { ChecklistEventHandlerHost } from './checklist_event_handler_types.js';
import type { ChecklistDomBuildHost } from './checklist_dom_build.js';
import type { ChecklistDomUpdateHost } from './checklist_dom_update.js';
import type { ChecklistObservationTextHost } from './checklist_observation_text.js';
import type { ChecklistStatusButtonHost, StatusButtonTrigger } from './checklist_status_button_ui.js';
import type { StatusChangeInfo } from './checklist_event_handler_types.js';
import type { DomUpdatePatchScope } from './checklist_dom_update.js';

export type ChecklistHandlerHelpers = {
    create_element: (...args: unknown[]) => HTMLElement;
    trim_textarea_preserve_lines?: (raw: string) => string;
    init_auto_resize_for_textarea?: (el: HTMLTextAreaElement) => void;
    escape_html?: (s: string) => string;
};

export type ChecklistHandlerTranslation = {
    t: (key: string, params?: Record<string, unknown>) => string;
    get_current_language_code?: () => string;
};

export type ChecklistCallbacks = {
    onStatusChange?: (change_info: StatusChangeInfo) => unknown;
    onObservationChange?: () => void;
    onObservationChangeImmediate?: () => void;
    onObservationBlurCommit?: () => void;
    onBeforeStatusChangeSync?: () => void;
    onStuckDescriptionSaved?: () => void | Promise<void>;
    onAttachedMediaSaved?: () => void;
    onObservationDraftUpdate?: (check_id: string, pc_id: string, text: string) => void;
    onObservationHideCommit?: () => void;
};

export type ChecklistInitOptions = {
    deps?: {
        Translation?: ChecklistHandlerTranslation;
        Helpers?: ChecklistHandlerHelpers;
    };
    getObservationsFromOtherSamples?: (check_id: string, pc_id: string) => string[];
    getDomFocusSyncRoot?: () => HTMLElement | null;
    getIsAuditFrozen?: () => boolean;
    getIsAuditArchived?: () => boolean;
    lockHelpers?: ChecklistLockHelpers | null;
    getAuditId?: () => string | null;
    getSampleId?: () => string | null;
    getRequirementMapKey?: () => string | null;
    getState?: () => { auditStatus?: string } | null;
    getPcObservationDraft?: (check_id: string, pc_id: string) => string | undefined;
};

export type ChecklistModuleHost =
    ChecklistEventHandlerHost &
    ChecklistStatusButtonHost &
    ChecklistDomUpdateHost &
    ChecklistDomBuildHost &
    ChecklistObservationTextHost;

export type ChecklistHandlerCore = {
    container_ref: HTMLElement | null;
    requirement_definition_ref: ChecklistDomBuildHost['requirement_definition_ref'];
    requirement_result_ref: ChecklistDomUpdateHost['requirement_result_ref'];
    requirement_update_details: ChecklistDomBuildHost['requirement_update_details'];
    _patch_scope: DomUpdatePatchScope;
    is_dom_built: boolean;
    last_language_code: string | null;
    is_audit_locked: boolean;
    Translation: ChecklistHandlerTranslation | null;
    Helpers: ChecklistHandlerHelpers | null;
    get_is_audit_frozen: (() => boolean) | null;
    get_is_audit_archived: (() => boolean) | null;
    _status_button_triggers: Map<string, StatusButtonTrigger>;
    _audit_frozen_for_ui(): boolean;
    _audit_archived_for_ui(): boolean;
    _requirement_definition_identity(requirement_definition: Record<string, unknown> | null): string;
    build_initial_dom(): void;
    update_dom(): void;
    _resume_blocked_panel_animation(check_wrapper: HTMLElement): void;
};

export function as_checklist_module_host(host: ChecklistHandlerCore): ChecklistModuleHost {
    return host as unknown as ChecklistModuleHost;
}
