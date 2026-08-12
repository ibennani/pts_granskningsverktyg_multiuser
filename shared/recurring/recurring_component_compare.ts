/**
 * @fileoverview Ren cross-page-logik för att föreslå stora återkommande granskningsdelar.
 */

export type RecurringCandidateType =
    | 'header'
    | 'menu'
    | 'footer'
    | 'section_navigation'
    | 'other_recurring';

export type RecurringComponentCandidate = {
    candidateType?: string;
    score?: number;
    confidence?: string;
    structureFingerprint?: string | null;
    domPath?: string | null;
    parentHeaderPath?: string | null;
    linkLabels?: string[] | null;
    counts?: Record<string, number> | null;
    boundingBox?: { x?: number; y?: number; width?: number; height?: number } | null;
    matchedSignals?: string[] | null;
};

export type RecurringPageEvidence = {
    sampleId: string;
    captureId?: string | null;
    url?: string | null;
    candidates?: RecurringComponentCandidate[] | null;
    consentUiFound?: boolean;
    consentEvidenceRef?: string | null;
};

export type RecurringComponentProposal = {
    proposalType: RecurringCandidateType | 'cookie';
    confidence: 'high' | 'medium' | 'low';
    score: number;
    occurrenceCount: number;
    pageCount: number;
    sampleIds: string[];
    representativeSampleId: string | null;
    representativeCaptureId: string | null;
    sourceFingerprints: string[];
    reasons: string[];
    ownership: {
        owner: string;
        excludeOwners?: string[];
    };
};

function normalized_labels(candidate: RecurringComponentCandidate): Set<string> {
    return new Set(
        (candidate.linkLabels || [])
            .map((value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim())
            .filter(Boolean)
    );
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    let intersection = 0;
    for (const value of a) if (b.has(value)) intersection += 1;
    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
}

function count_similarity(a: RecurringComponentCandidate, b: RecurringComponentCandidate): number {
    const keys = ['links', 'buttons', 'fields', 'headings', 'navigations'];
    let total = 0;
    let compared = 0;
    for (const key of keys) {
        const av = Number(a.counts?.[key]);
        const bv = Number(b.counts?.[key]);
        if (!Number.isFinite(av) || !Number.isFinite(bv)) continue;
        const max = Math.max(av, bv, 1);
        total += 1 - Math.min(Math.abs(av - bv) / max, 1);
        compared += 1;
    }
    return compared ? total / compared : 0;
}

export function recurring_candidate_similarity(
    a: RecurringComponentCandidate,
    b: RecurringComponentCandidate
): number {
    if (a.candidateType !== b.candidateType) return 0;
    const af = String(a.structureFingerprint || '');
    const bf = String(b.structureFingerprint || '');
    if (af && bf && af === bf) return 1;

    const links = jaccard(normalized_labels(a), normalized_labels(b));
    const counts = count_similarity(a, b);
    const pathA = String(a.domPath || '').replace(/:nth-of-type\(\d+\)/g, ':nth-of-type(*)');
    const pathB = String(b.domPath || '').replace(/:nth-of-type\(\d+\)/g, ':nth-of-type(*)');
    const pathScore = pathA && pathA === pathB ? 1 : 0;
    return Math.max(0, Math.min(1, links * 0.5 + counts * 0.3 + pathScore * 0.2));
}

type CandidateRef = {
    page: RecurringPageEvidence;
    candidate: RecurringComponentCandidate;
};

function best_candidate_per_page(
    pages: RecurringPageEvidence[],
    type: RecurringCandidateType
): CandidateRef[] {
    const result: CandidateRef[] = [];
    for (const page of pages) {
        const candidates = (page.candidates || [])
            .filter((candidate) => candidate.candidateType === type)
            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        if (candidates[0]) result.push({ page, candidate: candidates[0] });
    }
    return result;
}

function build_type_proposal(
    pages: RecurringPageEvidence[],
    type: RecurringCandidateType
): RecurringComponentProposal | null {
    const refs = best_candidate_per_page(pages, type);
    if (refs.length < 2) return null;

    let bestCluster: CandidateRef[] = [];
    let bestMean = 0;
    for (const seed of refs) {
        const cluster = refs.filter((ref) => recurring_candidate_similarity(seed.candidate, ref.candidate) >= 0.58);
        if (cluster.length < 2) continue;
        const mean = cluster.reduce(
            (sum, ref) => sum + recurring_candidate_similarity(seed.candidate, ref.candidate),
            0
        ) / cluster.length;
        if (cluster.length > bestCluster.length || (cluster.length === bestCluster.length && mean > bestMean)) {
            bestCluster = cluster;
            bestMean = mean;
        }
    }
    if (bestCluster.length < 2) return null;

    const occurrenceRatio = bestCluster.length / Math.max(pages.length, 1);
    const avgCandidateScore = bestCluster.reduce((sum, ref) => sum + Number(ref.candidate.score || 0), 0) / bestCluster.length;
    const score = Math.round(Math.min(100, occurrenceRatio * 55 + bestMean * 25 + avgCandidateScore * 0.2));
    const confidence: RecurringComponentProposal['confidence'] =
        score >= 85 && bestCluster.length >= 3 ? 'high' : score >= 68 ? 'medium' : 'low';

    const representative = [...bestCluster].sort(
        (a, b) => Number(b.candidate.score || 0) - Number(a.candidate.score || 0)
    )[0];
    const fingerprints = [...new Set(bestCluster.map((ref) => String(ref.candidate.structureFingerprint || '')).filter(Boolean))];

    const reasons = [
        `same-block-type:${type}`,
        `occurs:${bestCluster.length}/${pages.length}`,
        `mean-similarity:${bestMean.toFixed(2)}`,
    ];
    if (bestCluster.some((ref) => (ref.candidate.matchedSignals || []).some((signal) => String(signal).startsWith('semantic-')))) {
        reasons.push('semantic-signal-present');
    }

    return {
        proposalType: type,
        confidence,
        score,
        occurrenceCount: bestCluster.length,
        pageCount: pages.length,
        sampleIds: bestCluster.map((ref) => ref.page.sampleId),
        representativeSampleId: representative?.page.sampleId || null,
        representativeCaptureId: representative?.page.captureId || null,
        sourceFingerprints: fingerprints,
        reasons,
        ownership: type === 'header'
            ? { owner: 'header', excludeOwners: ['menu'] }
            : { owner: type },
    };
}

function build_cookie_proposal(pages: RecurringPageEvidence[]): RecurringComponentProposal | null {
    const matches = pages.filter((page) => page.consentUiFound === true);
    if (matches.length === 0) return null;
    return {
        proposalType: 'cookie',
        confidence: 'high',
        score: 95,
        occurrenceCount: matches.length,
        pageCount: pages.length,
        sampleIds: matches.map((page) => page.sampleId),
        representativeSampleId: matches[0]?.sampleId || null,
        representativeCaptureId: matches[0]?.captureId || null,
        sourceFingerprints: [],
        reasons: ['initial-consent-ui-observed', `observed:${matches.length}/${pages.length}`],
        ownership: { owner: 'cookie' },
    };
}

export function build_recurring_component_proposals(
    pages: RecurringPageEvidence[]
): RecurringComponentProposal[] {
    const validPages = pages.filter((page) => page && String(page.sampleId || '').trim());
    if (validPages.length === 0) return [];
    const proposals: RecurringComponentProposal[] = [];
    for (const type of ['header', 'menu', 'footer', 'section_navigation'] as RecurringCandidateType[]) {
        const proposal = build_type_proposal(validPages, type);
        if (proposal) proposals.push(proposal);
    }
    const cookie = build_cookie_proposal(validPages);
    if (cookie) proposals.push(cookie);
    return proposals.sort((a, b) => b.score - a.score || a.proposalType.localeCompare(b.proposalType));
}
