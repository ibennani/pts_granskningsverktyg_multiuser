/**
 * @fileoverview Cross-page-analys av återkommande block från sidrapporter.
 */
import fs from 'fs/promises';
import JSZip from 'jszip';
import { get_snapshot_archive_path } from '../snapshots/audit_snapshot_storage.js';
import {
    build_structure_node_from_eval,
    structure_fingerprint_hash,
    structure_similarity_score,
    type StructureNode,
} from '../../shared/recurring/structure_fingerprint.js';

export type RecurringContentSuggestion = {
    id: string;
    candidateType: string;
    occursOnPageCount: number;
    totalPageCount: number;
    matchedSignals: string[];
    rootIdentity: string;
    structureFingerprint: string;
    evidenceRefs: {
        sampleIds: string[];
        captureIds: string[];
    };
};

type PageBlockCandidate = {
    candidateType?: string;
    matchedSignals?: string[];
    rootIdentity?: string;
    structureFingerprint?: string;
    structureNode?: {
        tagName?: string;
        role?: string | null;
        children?: Array<{ tagName?: string; role?: string | null }>;
    };
};

const SIMILARITY_THRESHOLD = 0.75;

async function read_page_blocks_from_archive(
    audit_id: string,
    capture_id: string
): Promise<PageBlockCandidate[]> {
    const archive_path = get_snapshot_archive_path(audit_id, capture_id);
    try {
        const buffer = await fs.readFile(archive_path);
        const zip = await JSZip.loadAsync(buffer);
        const entry = zip.file('analysis/phase1/page-blocks.json');
        if (!entry) return [];
        const envelope = JSON.parse(await entry.async('string')) as {
            data?: { candidates?: PageBlockCandidate[] };
        };
        return Array.isArray(envelope.data?.candidates) ? envelope.data.candidates : [];
    } catch {
        return [];
    }
}

function fingerprint_for_candidate(candidate: PageBlockCandidate): string {
    if (candidate.structureFingerprint) {
        return candidate.structureFingerprint;
    }
    const node = build_structure_node_from_eval(candidate.structureNode || {});
    return structure_fingerprint_hash(node);
}

function node_from_candidate(candidate: PageBlockCandidate): StructureNode {
    return build_structure_node_from_eval(candidate.structureNode || {});
}

export async function analyze_recurring_content_for_audit(input: {
    audit_id: string;
    entries: Array<{ sampleId: string; captureId: string }>;
}): Promise<RecurringContentSuggestion[]> {
    if (input.entries.length < 2) {
        return [];
    }

    type ClusterMember = {
        sampleId: string;
        captureId: string;
        candidate: PageBlockCandidate;
        fingerprint: string;
        node: StructureNode;
    };

    const members: ClusterMember[] = [];
    for (const entry of input.entries) {
        const candidates = await read_page_blocks_from_archive(input.audit_id, entry.captureId);
        for (const candidate of candidates) {
            const candidate_type = String(candidate.candidateType || '').trim();
            if (!candidate_type || candidate_type === 'other_recurring') continue;
            members.push({
                sampleId: entry.sampleId,
                captureId: entry.captureId,
                candidate,
                fingerprint: fingerprint_for_candidate(candidate),
                node: node_from_candidate(candidate),
            });
        }
    }

    const clusters: ClusterMember[][] = [];
    for (const member of members) {
        let placed = false;
        for (const cluster of clusters) {
            const ref = cluster[0];
            if (ref.candidate.candidateType !== member.candidate.candidateType) continue;
            const same_hash = ref.fingerprint === member.fingerprint;
            const similar = structure_similarity_score(ref.node, member.node) >= SIMILARITY_THRESHOLD;
            if (same_hash || similar) {
                cluster.push(member);
                placed = true;
                break;
            }
        }
        if (!placed) {
            clusters.push([member]);
        }
    }

    const total_pages = input.entries.length;
    const suggestions: RecurringContentSuggestion[] = [];

    clusters.forEach((cluster, index) => {
        const unique_pages = new Set(cluster.map((m) => m.captureId));
        if (unique_pages.size < 2) return;
        const first = cluster[0];
        suggestions.push({
            id: `recurring-${first.candidate.candidateType}-${index + 1}`,
            candidateType: String(first.candidate.candidateType),
            occursOnPageCount: unique_pages.size,
            totalPageCount: total_pages,
            matchedSignals: [
                ...new Set(cluster.flatMap((m) => m.candidate.matchedSignals || [])),
            ],
            rootIdentity: String(first.candidate.rootIdentity || ''),
            structureFingerprint: first.fingerprint,
            evidenceRefs: {
                sampleIds: [...new Set(cluster.map((m) => m.sampleId))],
                captureIds: [...unique_pages],
            },
        });
    });

    return suggestions.sort((a, b) => b.occursOnPageCount - a.occursOnPageCount);
}
