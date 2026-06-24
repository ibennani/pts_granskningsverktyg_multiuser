/**
 * @fileoverview Normaliserar bifogade filnamn på stickprov (skärmavbildningar) vid inläsning.
 */

import { coerce_to_array } from './sanitize_persisted_app_state.js';

/** Returnerar en trimmad lista med icke-tomma filnamn, eller tom lista. */
export function normalize_attached_media_filenames_list(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.map((filename) => String(filename).trim()).filter(Boolean);
}

/** Säkerställer attachedMediaFilenames på ett stickprovsobjekt. */
export function ensure_sample_attached_media_shape(sample: unknown): unknown {
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
        return sample;
    }
    const record = sample as Record<string, unknown>;
    const url_auto = record.urlAutoScreenshotFilename;
    const normalized_auto =
        typeof url_auto === 'string' && url_auto.trim() ? url_auto.trim() : null;
    return {
        ...record,
        attachedMediaFilenames: normalize_attached_media_filenames_list(record.attachedMediaFilenames),
        ...(Object.prototype.hasOwnProperty.call(record, 'urlAutoScreenshotFilename')
            ? { urlAutoScreenshotFilename: normalized_auto }
            : {})
    };
}

/** Säkerställer attachedMediaFilenames på alla stickprov i en granskning. */
export function ensure_samples_attached_media_shape(samples: unknown): unknown[] {
    return coerce_to_array(samples).map((sample) => ensure_sample_attached_media_shape(sample));
}

type Sample_media_source_state = {
    sampleEditDraft?: {
        sampleId?: string;
        updatedSampleData?: { attachedMediaFilenames?: unknown };
    } | null;
    pendingSampleChanges?: {
        sampleId?: string;
        updatedSampleData?: { attachedMediaFilenames?: unknown };
    } | null;
};

function read_attached_filenames_from_staged_source(
    source: { sampleId?: string; updatedSampleData?: { attachedMediaFilenames?: unknown } } | null | undefined,
    sample_id: string
): string[] | null {
    if (!source || String(source.sampleId ?? '') !== String(sample_id)) {
        return null;
    }
    const updated = source.updatedSampleData;
    if (!updated || !Object.prototype.hasOwnProperty.call(updated, 'attachedMediaFilenames')) {
        return null;
    }
    return normalize_attached_media_filenames_list(updated.attachedMediaFilenames);
}

/**
 * Stickprov för serversynk/import: attachedMediaFilenames från utkast eller väntande ändringar
 * slås in så att bifogad media inte försvinner vid statusbyte eller PATCH.
 */
export function resolve_samples_for_server_sync(
    state: Sample_media_source_state | null | undefined,
    samples: unknown
): unknown[] {
    return coerce_to_array(samples).map((sample) => {
        if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
            return sample;
        }
        const record = sample as Record<string, unknown> & { id?: string; attachedMediaFilenames?: unknown };
        return {
            ...record,
            attachedMediaFilenames: resolve_effective_sample_attached_filenames(state, record)
        };
    });
}

/** Returnerar aktuell lista med bifogade filnamn för ett stickprov, inklusive utkast och väntande ändringar. */
export function resolve_effective_sample_attached_filenames(
    state: Sample_media_source_state | null | undefined,
    sample: { id?: string; attachedMediaFilenames?: unknown } | null | undefined
): string[] {
    const sample_id = sample?.id;
    if (sample_id != null && String(sample_id) !== '') {
        const from_pending = read_attached_filenames_from_staged_source(state?.pendingSampleChanges, String(sample_id));
        if (from_pending !== null) {
            return from_pending;
        }
        const from_draft = read_attached_filenames_from_staged_source(state?.sampleEditDraft, String(sample_id));
        if (from_draft !== null) {
            return from_draft;
        }
    }
    return normalize_attached_media_filenames_list(sample?.attachedMediaFilenames);
}

export function sort_audit_image_card_groups<T extends { is_sample_screenshot?: boolean; reqId?: string | null; sample?: { id?: string; description?: string } | null }>(
    groups: T[]
): T[] {
    return [...groups].sort((left, right) => {
        const left_is_sample = !!left.is_sample_screenshot;
        const right_is_sample = !!right.is_sample_screenshot;
        if (left_is_sample !== right_is_sample) {
            return left_is_sample ? -1 : 1;
        }
        if (left_is_sample && right_is_sample) {
            const left_label = String(left.sample?.description || left.sample?.id || '');
            const right_label = String(right.sample?.description || right.sample?.id || '');
            return left_label.localeCompare(right_label, 'sv');
        }
        const left_key = `${left.reqId || ''}::${left.sample?.id || ''}`;
        const right_key = `${right.reqId || ''}::${right.sample?.id || ''}`;
        return left_key.localeCompare(right_key, 'sv');
    });
}
