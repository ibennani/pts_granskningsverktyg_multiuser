/**
 * @file Klienthjälp för användar-id och visningsnamn.
 */

import { get_current_user_name } from '../user/current_user.js';

const AUTH_USER_ID_KEY = 'gv_current_user_id';
import {
    build_account_select_options,
    format_stored_user_reference,
    is_user_uuid,
    resolve_account_display_name,
    resolve_account_label,
} from '../../shared/user/user_identity.js';

export type AccountSelectOption = { value: string; label: string };

export {
    build_account_select_options,
    format_stored_user_reference,
    is_user_uuid,
    resolve_account_display_name,
    resolve_account_label,
};

/** Läser inloggad användares id från sessionStorage (undviker hårt beroende till api/client i tester). */
function read_current_user_id_from_session(): string {
    if (typeof window === 'undefined') return '';
    try {
        const raw = sessionStorage.getItem(AUTH_USER_ID_KEY);
        return raw && String(raw).trim() ? String(raw).trim() : '';
    } catch {
        return '';
    }
}

/** Normaliserar användar-id för jämförelse och nycklar. */
export function normalize_user_id_key(user_id: string | null | undefined): string {
    return String(user_id ?? '').trim().toLowerCase();
}

/** Inloggad användares id, normaliserat. */
export function get_current_user_id_key(): string {
    return normalize_user_id_key(read_current_user_id_from_session());
}

/**
 * Läser ansvarig användare från en granskningsrad (id först, annars legacy-namn).
 */
export function read_audit_responsible_user_id(
    audit: { responsibleUserId?: string | null; responsible_user_id?: string | null } | null | undefined
): string {
    const raw = audit?.responsibleUserId ?? audit?.responsible_user_id ?? '';
    return String(raw ?? '').trim();
}

/**
 * Visningsnamn för ansvarig granskare på en listrad.
 */
export function read_audit_auditor_display_name(
    audit: {
        responsibleUserId?: string | null;
        responsible_user_id?: string | null;
        metadata?: { auditorName?: string | null };
    } | null | undefined,
    account_options: AccountSelectOption[] = []
): string {
    const user_id = read_audit_responsible_user_id(audit);
    const from_id = resolve_account_label(user_id, account_options, '');
    if (from_id) return from_id;
    return String(audit?.metadata?.auditorName ?? '').trim();
}

/** Sant om raden tillhör inloggad användare (id först, namn som legacy). */
export function audit_row_belongs_to_current_user(
    audit: {
        responsibleUserId?: string | null;
        responsible_user_id?: string | null;
        metadata?: { auditorName?: string | null };
    } | null | undefined
): boolean {
    const current_id = get_current_user_id_key();
    if (current_id) {
        const row_id = normalize_user_id_key(read_audit_responsible_user_id(audit));
        if (row_id) return row_id === current_id;
    }
    const current_name = get_current_user_name().trim().toLowerCase();
    if (!current_name) return false;
    const auditor = String(audit?.metadata?.auditorName ?? '').trim().toLowerCase();
    return auditor === current_name;
}

/** Gruppnyckel för ansvarig granskare (användar-id om finns, annars legacy-namn). */
export function audit_responsible_group_key(
    audit: {
        responsibleUserId?: string | null;
        responsible_user_id?: string | null;
        metadata?: { auditorName?: string | null };
    } | null | undefined
): string {
    const user_id = read_audit_responsible_user_id(audit);
    if (user_id) return normalize_user_id_key(user_id);
    return String(audit?.metadata?.auditorName ?? '').trim().toLowerCase();
}
