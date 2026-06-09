/**
 * @fileoverview Senast aktivitet under pågående granskning — listvisning och metadata.
 */

import { get_last_activity_timestamp } from './audit_logic_recalc.js';
import type { AuditStateShape } from './audit_logic_types.js';

/** Metadata-nyckel: fryst tidpunkt för senaste interaktion medan granskningen var pågående. */
export const AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY = 'lastInProgressActivityAt';

export type AuditListLastUpdatedInput = {
    status?: string | null;
    metadata?: Record<string, unknown> | null;
    samples?: unknown;
    updated_at?: string | null;
};

function parse_samples_array(samples: unknown): AuditStateShape['samples'] {
    if (!samples) return undefined;
    if (Array.isArray(samples)) return samples as AuditStateShape['samples'];
    if (typeof samples === 'string') {
        try {
            const parsed = JSON.parse(samples) as unknown;
            return Array.isArray(parsed) ? (parsed as AuditStateShape['samples']) : undefined;
        } catch {
            return undefined;
        }
    }
    return undefined;
}

/** Senaste giltiga ISO-sträng bland kandidater (lexikografisk jämförelse fungerar för UTC ISO). */
export function max_iso_timestamps(...candidates: (string | null | undefined)[]): string | null {
    let max: string | null = null;
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') continue;
        if (!max || candidate > max) max = candidate;
    }
    return max;
}

/** Senaste interaktionstid från stickprov (krav, kontroller, kriterier). */
export function get_last_activity_from_samples(samples: unknown): string | null {
    const parsed = parse_samples_array(samples);
    if (!parsed) return null;
    return get_last_activity_timestamp({ samples: parsed });
}

/**
 * Tid som ska visas som "Senast ändrad" i granskningslistan.
 * Avslutade/arkiverade: fryst metadata-värde, annars beräknat från stickprov.
 * Pågående: senaste av metadata-fält och stickprov.
 */
export function resolve_audit_list_last_updated_at(input: AuditListLastUpdatedInput): string | null {
    const status = (input.status ?? '').toString();
    const metadata = input.metadata ?? {};
    const frozen_meta = metadata[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY];
    const frozen =
        typeof frozen_meta === 'string' && frozen_meta ? frozen_meta : null;
    const from_samples = get_last_activity_from_samples(input.samples);

    if (status === 'locked' || status === 'archived') {
        return frozen || from_samples || input.updated_at || null;
    }
    if (status === 'in_progress') {
        return max_iso_timestamps(frozen, from_samples) || input.updated_at || null;
    }
    return input.updated_at || null;
}

export function with_last_in_progress_activity_in_metadata(
    audit_metadata: Record<string, unknown> | null | undefined,
    activity_at: string | null | undefined
): Record<string, unknown> {
    const base = { ...(audit_metadata ?? {}) };
    if (!activity_at) return base;
    const next = max_iso_timestamps(
        typeof base[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY] === 'string'
            ? (base[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY] as string)
            : null,
        activity_at
    );
    if (!next) return base;
    return { ...base, [AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY]: next };
}

export function without_last_in_progress_activity_in_metadata(
    audit_metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    const out = { ...(audit_metadata ?? {}) };
    delete out[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY];
    return out;
}

/** Fryst visningstid från state/metadata (granskningsvy, export m.m.). */
export function get_frozen_last_in_progress_activity_at(
    audit_state: AuditStateShape | null | undefined
): string | null {
    if (!audit_state) return null;
    if (audit_state.auditLastUpdatedAtFrozen) {
        return audit_state.auditLastUpdatedAtFrozen;
    }
    const metadata = audit_state.auditMetadata as Record<string, unknown> | null | undefined;
    const meta = metadata?.[AUDIT_METADATA_LAST_IN_PROGRESS_ACTIVITY_KEY];
    return typeof meta === 'string' && meta ? meta : null;
}
