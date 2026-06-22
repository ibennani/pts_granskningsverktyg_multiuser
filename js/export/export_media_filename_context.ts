/**
 * @fileoverview Bygger kontext för exportfilnamn vid Excel-export.
 */

import { get_audits } from '../api/client.js';
import {
    resolve_audit_export_type_abbrev,
    resolve_audit_type_for_export,
    resolve_granskning_sequence_number,
    type AuditListRowForSequence
} from '../logic/audit_granskning_sequence.js';
import { resolve_media_capture_dates } from '../logic/media_capture_date.js';
import {
    for_each_failed_export_pass_criterion,
    resolve_deficiency_id_part_width
} from './export_deficiency_traversal.js';

export type ExportMediaFilenameContext = {
    audit_type_label: string;
    granskning_sequence: number;
    case_number: string;
    deficiency_id_part_width: number;
    capture_dates: Map<string, string>;
};

function collect_deficiency_media_filenames(current_audit: unknown): string[] {
    const names = new Set<string>();
    for_each_failed_export_pass_criterion(current_audit, ({ pc_obj }) => {
        const filenames = (pc_obj as { attachedMediaFilenames?: unknown }).attachedMediaFilenames;
        if (!Array.isArray(filenames)) return;
        filenames.forEach((name) => {
            const trimmed = String(name || '').trim();
            if (trimmed) names.add(trimmed);
        });
    });
    return [...names];
}

function collect_sample_media_filenames(current_audit: unknown): string[] {
    const names = new Set<string>();
    const samples = (current_audit as { samples?: unknown[] })?.samples || [];
    samples.forEach((sample) => {
        const filenames = (sample as { attachedMediaFilenames?: unknown }).attachedMediaFilenames;
        if (!Array.isArray(filenames)) return;
        filenames.forEach((name) => {
            const trimmed = String(name || '').trim();
            if (trimmed) names.add(trimmed);
        });
    });
    return [...names];
}

function collect_all_export_media_filenames(current_audit: unknown): string[] {
    const names = new Set<string>();
    collect_deficiency_media_filenames(current_audit).forEach((name) => names.add(name));
    collect_sample_media_filenames(current_audit).forEach((name) => names.add(name));
    return [...names];
}

async function fetch_audit_list_for_sequence(): Promise<AuditListRowForSequence[]> {
    try {
        const data = await get_audits();
        if (Array.isArray(data)) return data as AuditListRowForSequence[];
        if (data && Array.isArray((data as { audits?: unknown }).audits)) {
            return (data as { audits: AuditListRowForSequence[] }).audits;
        }
    } catch {
        /* fallback nedan */
    }
    return [];
}

/**
 * Bygger kontext för exportfilnamn. Returnerar null om typ saknas (då används råa filnamn).
 */
export async function build_export_media_filename_context(
    current_audit: unknown,
    export_date: Date = new Date()
): Promise<ExportMediaFilenameContext | null> {
    const audit = current_audit as {
        auditId?: string;
        auditMetadata?: { caseNumber?: string };
        ruleFileContent?: unknown;
    };

    const audit_type = resolve_audit_type_for_export(audit.ruleFileContent);
    const audit_type_label = resolve_audit_export_type_abbrev(audit_type, audit.ruleFileContent);
    if (!audit_type_label) {
        return null;
    }

    const case_number = String(audit.auditMetadata?.caseNumber ?? '').trim();
    const audit_list = await fetch_audit_list_for_sequence();
    const granskning_sequence = resolve_granskning_sequence_number(audit_list, {
        audit_id: audit.auditId,
        case_number,
        audit_type
    });

    const deficiency_id_part_width = resolve_deficiency_id_part_width(current_audit);
    const filenames = collect_all_export_media_filenames(current_audit);
    const capture_dates = await resolve_media_capture_dates(audit.auditId, filenames, export_date);

    return {
        audit_type_label,
        granskning_sequence,
        case_number,
        deficiency_id_part_width,
        capture_dates
    };
}
