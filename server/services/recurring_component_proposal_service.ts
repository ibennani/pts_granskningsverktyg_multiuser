/**
 * @fileoverview Läser färdiga sidrapporter och bygger deterministiska förslag på stora återkommande granskningsdelar.
 */
import fs from 'fs/promises';
import JSZip from 'jszip';
import { query } from '../db.js';
import { build_audit_snapshot_list } from './audit_snapshot_list_service.js';
import { get_snapshot_archive_path } from '../snapshots/audit_snapshot_storage.js';
import {
    build_recurring_component_proposals,
    type RecurringPageEvidence,
    type RecurringComponentProposal,
} from '../../shared/recurring/recurring_component_compare.js';

type AuditSample = {
    id: string;
    description?: string;
    url?: string;
};

type ModuleEnvelope = {
    data?: Record<string, unknown> | null;
};

async function read_json_from_zip<T>(zip: JSZip, filename: string): Promise<T | null> {
    const entry = zip.file(filename);
    if (!entry) return null;
    try {
        return JSON.parse(await entry.async('string')) as T;
    } catch {
        return null;
    }
}

async function get_samples(audit_id: string): Promise<AuditSample[]> {
    const result = await query('SELECT samples FROM audits WHERE id = $1', [audit_id]);
    if (result.rows.length === 0) return [];
    const raw = result.rows[0]?.samples;
    if (Array.isArray(raw)) return raw as AuditSample[];
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed as AuditSample[] : [];
        } catch {
            return [];
        }
    }
    return [];
}

export type RecurringProposalResult = {
    pagesAnalyzed: number;
    proposals: RecurringComponentProposal[];
    evidence: RecurringPageEvidence[];
};

export async function build_recurring_proposals_for_audit(
    audit_id: string
): Promise<RecurringProposalResult> {
    const samples = await get_samples(audit_id);
    const list = await build_audit_snapshot_list(audit_id, samples);
    const evidence: RecurringPageEvidence[] = [];

    for (const item of list) {
        const ready = item.currentReady;
        if (!ready) continue;
        try {
            const archive = await fs.readFile(get_snapshot_archive_path(audit_id, ready.snapshotId));
            const zip = await JSZip.loadAsync(archive);
            const recurring = await read_json_from_zip<ModuleEnvelope>(
                zip,
                'analysis/phase1/recurring-components.json'
            );
            const consent = await read_json_from_zip<ModuleEnvelope>(
                zip,
                'analysis/phase1/initial-consent.json'
            );
            const recurring_data = recurring?.data || {};
            const consent_data = consent?.data || {};
            evidence.push({
                sampleId: item.sampleId,
                captureId: ready.snapshotId,
                url: item.requestedUrl || null,
                candidates: Array.isArray(recurring_data.candidates)
                    ? recurring_data.candidates as RecurringPageEvidence['candidates']
                    : [],
                consentUiFound: consent_data.consentUiFound === true,
                consentEvidenceRef: consent_data.consentUiFound === true
                    ? `analysis/phase1/initial-consent.json`
                    : null,
            });
        } catch {
            // En trasig/äldre rapport ska inte stoppa förslag från övriga sidor.
        }
    }

    return {
        pagesAnalyzed: evidence.length,
        proposals: build_recurring_component_proposals(evidence),
        evidence,
    };
}
