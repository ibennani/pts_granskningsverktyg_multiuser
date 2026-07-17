/**
 * @fileoverview Blockerar bilaga-export när granskningstyp saknas.
 */

import { has_audit_type_id } from '../../shared/audit/audit_type_metadata.js';

type AuditStateLike = {
    ruleFileContent?: unknown;
    auditMetadata?: { auditTypeId?: string };
};

type NotificationLike = {
    show_global_message?: (message: string, type: string) => void;
};

export function audit_export_requires_audit_type(state: AuditStateLike | null | undefined): boolean {
    if (!state?.ruleFileContent) return false;
    return !has_audit_type_id(state.auditMetadata ?? null);
}

export function notify_audit_type_required_for_export(
    NotificationComponent: NotificationLike | null | undefined,
    t: (key: string) => string
): void {
    NotificationComponent?.show_global_message?.(t('audit_export_requires_audit_type'), 'error');
}

export function guard_audit_type_for_export(
    state: AuditStateLike | null | undefined,
    NotificationComponent: NotificationLike | null | undefined,
    t: (key: string) => string
): boolean {
    if (!audit_export_requires_audit_type(state)) return true;
    notify_audit_type_required_for_export(NotificationComponent, t);
    return false;
}
