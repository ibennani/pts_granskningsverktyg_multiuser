/**
 * @fileoverview Samlar referenser till bifogade mediefiler i en granskning.
 */

import { traverse_all_pass_criteria } from '../utils/traverse_audit_data.js';
import {
    normalize_attached_media_filenames_list,
    resolve_effective_sample_attached_filenames
} from './sample_attached_media_normalize.js';

type AuditSamplesState = {
    samples?: Array<{
        id?: string;
        attachedMediaFilenames?: unknown;
        requirementResults?: Record<
            string,
            {
                checkResults?: Record<
                    string,
                    {
                        passCriteria?: Record<string, { attachedMediaFilenames?: unknown }>;
                    }
                >;
            }
        >;
    }>;
    sampleEditDraft?: {
        sampleId?: string;
        updatedSampleData?: { attachedMediaFilenames?: unknown };
    } | null;
    pendingSampleChanges?: {
        sampleId?: string;
        updatedSampleData?: { attachedMediaFilenames?: unknown };
    } | null;
};

export type AttachedMediaReferenceOverride =
    | {
          type: 'sample';
          sampleId: string;
          filenames: string[];
      }
    | {
          type: 'pc';
          sampleId: string;
          requirementId: string;
          checkId: string;
          pcId: string;
          filenames: string[];
      };

function resolve_sample_filenames_for_collect(
    state: AuditSamplesState | null | undefined,
    sample: { id?: string; attachedMediaFilenames?: unknown },
    override?: AttachedMediaReferenceOverride
): string[] {
    if (override?.type === 'sample' && String(sample.id) === String(override.sampleId)) {
        return normalize_attached_media_filenames_list(override.filenames);
    }
    return resolve_effective_sample_attached_filenames(state, sample);
}

function resolve_pc_filenames_for_collect(
    pc_result: { attachedMediaFilenames?: unknown } | null | undefined,
    ctx: {
        sample_id: string;
        requirement_id: string;
        check_id: string;
        pc_id: string;
    },
    override?: AttachedMediaReferenceOverride
): string[] {
    if (
        override?.type === 'pc'
        && String(ctx.sample_id) === String(override.sampleId)
        && ctx.requirement_id === override.requirementId
        && ctx.check_id === override.checkId
        && ctx.pc_id === override.pcId
    ) {
        return normalize_attached_media_filenames_list(override.filenames);
    }
    return normalize_attached_media_filenames_list(pc_result?.attachedMediaFilenames);
}

/**
 * Returnerar alla filnamn som fortfarande refereras i granskningen (med valfri ersättning).
 */
export function collect_attached_media_filenames(
    state: AuditSamplesState | null | undefined,
    override?: AttachedMediaReferenceOverride
): Set<string> {
    const referenced = new Set<string>();

    for (const sample of state?.samples ?? []) {
        const sample_id = String(sample.id ?? '');
        resolve_sample_filenames_for_collect(state, sample, override).forEach((name) => referenced.add(name));
    }

    traverse_all_pass_criteria(state, ({ sample, req_key, check_key, pc_key, pc_result }) => {
        const filenames = resolve_pc_filenames_for_collect(
            pc_result,
            {
                sample_id: String(sample.id ?? ''),
                requirement_id: req_key,
                check_id: check_key,
                pc_id: pc_key
            },
            override
        );
        filenames.forEach((name) => referenced.add(name));
    });

    return referenced;
}

/**
 * Filnamn som tagits bort från en plats och inte längre refereras någonstans.
 */
export function filenames_safe_to_delete_from_server(
    removed_filenames: string[],
    still_referenced: Set<string>
): string[] {
    return removed_filenames.filter((name) => {
        const trimmed = String(name || '').trim();
        return trimmed.length > 0 && !still_referenced.has(trimmed);
    });
}
