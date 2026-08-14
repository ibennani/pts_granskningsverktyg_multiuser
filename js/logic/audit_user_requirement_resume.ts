/**
 * @fileoverview Sparar och läser per-användare «senaste krav-position» i granskningens metadata.
 * Följer med export, serversynk och import mellan Leffe-instanser.
 */

import { FILENAME_DISPLAY_TIMEZONE } from '../../shared/datetime/filename_datetime.js';
import { is_user_uuid } from '../../shared/user/user_identity.js';
import { normalize_user_id_key } from './user_identity.js';
import type { RuleFileForAudit, SampleStored } from './audit_logic_types.js';
import { calculate_overall_audit_progress } from './audit_logic_progress.js';
import { get_relevant_requirements_for_sample } from './audit_logic_requirements_lists.js';
import { definition_primary_id } from './entity_id_match.js';

export const USER_LAST_REQUIREMENT_RESUME_METADATA_KEY = 'userLastRequirementResumeByUser';

export type ResumeFocusInfo = Record<string, unknown>;

export type UserRequirementResumeEntry = {
    displayUserName: string;
    lastUpdatedDate: string;
    lastUpdatedTime: string;
    lastUpdatedAtIso: string;
    sampleId: string;
    requirementId: string;
    focusInfo: ResumeFocusInfo;
};

export type ResumeMetadataMap = Record<string, UserRequirementResumeEntry>;

function part_value(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
    return parts.find((p) => p.type === type)?.value ?? '00';
}

/** Normaliserar användarnyckel (användar-id eller legacy visningsnamn). */
export function normalize_resume_user_key(user_ref: string): string {
    const trimmed = String(user_ref || '').trim();
    if (!trimmed) return '';
    if (is_user_uuid(trimmed)) return normalize_user_id_key(trimmed);
    return trimmed.toLowerCase();
}

function resolve_resume_lookup_keys(user_ref: string): string[] {
    const primary = normalize_resume_user_key(user_ref);
    if (!primary) return [];
    if (is_user_uuid(user_ref)) return [primary];
    return [primary];
}

/** Datum och klockslag i Europe/Stockholm för resume-metadata. */
export function format_resume_local_timestamp(iso?: string | null): {
    date: string;
    time: string;
    iso: string;
} {
    const d = iso ? new Date(iso) : new Date();
    const safe = Number.isNaN(d.getTime()) ? new Date() : d;
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: FILENAME_DISPLAY_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(safe);
    const y = part_value(parts, 'year');
    const m = part_value(parts, 'month');
    const day = part_value(parts, 'day');
    const hh = part_value(parts, 'hour');
    const mm = part_value(parts, 'minute');
    const ss = part_value(parts, 'second');
    return {
        date: `${y}-${m}-${day}`,
        time: `${hh}:${mm}:${ss}`,
        iso: safe.toISOString()
    };
}

function coerce_resume_map(metadata: Record<string, unknown> | null | undefined): ResumeMetadataMap {
    const raw = metadata?.[USER_LAST_REQUIREMENT_RESUME_METADATA_KEY];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
    }
    return raw as ResumeMetadataMap;
}

export function get_user_resume_from_metadata(
    metadata: Record<string, unknown> | null | undefined,
    user_ref: string
): UserRequirementResumeEntry | null {
    const keys = resolve_resume_lookup_keys(user_ref);
    if (!keys.length) return null;
    const map = coerce_resume_map(metadata);
    for (const key of keys) {
        const entry = map[key];
        if (!entry || typeof entry !== 'object') continue;
        const sample_id = String(entry.sampleId || '').trim();
        const requirement_id = String(entry.requirementId || '').trim();
        const focus_info = entry.focusInfo;
        if (!sample_id || !requirement_id) continue;
        if (!focus_info || typeof focus_info !== 'object' || Array.isArray(focus_info)) continue;
        return entry;
    }
    return null;
}

export function build_resume_metadata_patch(
    metadata: Record<string, unknown> | null | undefined,
    user_ref: string,
    sample_id: string,
    requirement_id: string,
    focus_info: ResumeFocusInfo,
    updated_at_iso?: string | null,
    display_name = ''
): Record<string, unknown> {
    const key = normalize_resume_user_key(user_ref);
    const resolved_display = String(display_name || user_ref || '').trim();
    const ts = format_resume_local_timestamp(updated_at_iso ?? null);
    const prev_map = coerce_resume_map(metadata);
    const next_map: ResumeMetadataMap = {
        ...prev_map,
        [key]: {
            displayUserName: resolved_display,
            lastUpdatedDate: ts.date,
            lastUpdatedTime: ts.time,
            lastUpdatedAtIso: ts.iso,
            sampleId: String(sample_id),
            requirementId: String(requirement_id),
            focusInfo: { ...focus_info }
        }
    };
    return {
        ...(metadata || {}),
        [USER_LAST_REQUIREMENT_RESUME_METADATA_KEY]: next_map
    };
}

export function without_user_last_requirement_resume_in_metadata(
    metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object') {
        return {};
    }
    const next = { ...metadata };
    delete next[USER_LAST_REQUIREMENT_RESUME_METADATA_KEY];
    return next;
}

export function is_valid_user_resume(state: Record<string, unknown>, resume: UserRequirementResumeEntry): boolean {
    const samples = Array.isArray(state.samples) ? state.samples : [];
    const sample = samples.find((s) => String((s as SampleStored).id) === String(resume.sampleId)) as
        | SampleStored
        | undefined;
    if (!sample) return false;
    const rule_file = state.ruleFileContent as RuleFileForAudit | null | undefined;
    if (!rule_file?.requirements) return false;
    const relevant = get_relevant_requirements_for_sample(rule_file, sample);
    return relevant.some((req_def) => definition_primary_id(req_def) === String(resume.requirementId));
}

export function user_id_exists_in_instance(
    user_id: string,
    known_users: Array<{ id?: string | null }> | null | undefined
): boolean {
    const key = normalize_user_id_key(user_id);
    if (!key || !Array.isArray(known_users)) return false;
    return known_users.some((u) => normalize_user_id_key(String(u?.id || '')) === key);
}

/** @deprecated Använd user_id_exists_in_instance */
export function user_name_exists_in_instance(
    user_name: string,
    known_users: Array<{ name?: string | null; id?: string | null }> | null | undefined
): boolean {
    const key = normalize_resume_user_key(user_name);
    if (!key || !Array.isArray(known_users)) return false;
    if (is_user_uuid(user_name)) {
        return user_id_exists_in_instance(user_name, known_users);
    }
    return known_users.some((u) => normalize_resume_user_key(String(u?.name || '')) === key);
}

export function should_show_audit_overview_continue_button(
    state: Record<string, unknown>,
    user_ref: string,
    known_users: Array<{ id?: string | null; name?: string | null }> | null | undefined
): boolean {
    if (String(state.auditStatus || '') !== 'in_progress') return false;
    if (!normalize_resume_user_key(user_ref)) return false;
    if (is_user_uuid(user_ref)) {
        if (!user_id_exists_in_instance(user_ref, known_users)) return false;
    } else if (!user_name_exists_in_instance(user_ref, known_users)) {
        return false;
    }

    const progress = calculate_overall_audit_progress(state as Parameters<typeof calculate_overall_audit_progress>[0]);
    const { audited, total } = progress;
    if (total <= 0) return false;
    const pct = (audited / total) * 100;
    if (pct <= 0 || pct >= 100) return false;

    const metadata = state.auditMetadata as Record<string, unknown> | undefined;
    const resume = get_user_resume_from_metadata(metadata, user_ref);
    if (!resume) return false;
    return is_valid_user_resume(state, resume);
}
