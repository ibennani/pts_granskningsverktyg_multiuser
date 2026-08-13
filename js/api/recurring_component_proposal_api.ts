/**
 * @fileoverview API för deterministiska förslag på återkommande granskningsdelar.
 */
import { get_auth_token, get_base_url, refresh_auth_token } from './client.js';

export type RecurringProposal = {
    proposalType: 'header' | 'menu' | 'footer' | 'section_navigation' | 'other_recurring' | 'cookie';
    confidence: 'high' | 'medium' | 'low';
    score: number;
    occurrenceCount: number;
    pageCount: number;
    sampleIds: string[];
    representativeSampleId: string | null;
    representativeCaptureId: string | null;
    reasons: string[];
    ownership: { owner: string; excludeOwners?: string[] };
};

export type RecurringProposalPreview = {
    sampleId: string;
    captureId: string | null;
    boundingBox?: { x?: number; y?: number; width?: number; height?: number } | null;
    counts?: Record<string, number> | null;
    matchedSignals?: string[] | null;
    domPath?: string | null;
};

export type RecurringProposalResponse = {
    pagesAnalyzed: number;
    proposals: RecurringProposal[];
    detectedContentTypesBySample: Record<string, string[]>;
    previews: Record<string, RecurringProposalPreview | null>;
};

async function authorized_fetch(url: string): Promise<Response> {
    const headers = new Headers();
    const token = get_auth_token();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    let response = await fetch(url, { headers, cache: 'no-store' });
    if (response.status === 401 && await refresh_auth_token()) {
        const retry = new Headers();
        const refreshed = get_auth_token();
        if (refreshed) retry.set('Authorization', `Bearer ${refreshed}`);
        response = await fetch(url, { headers: retry, cache: 'no-store' });
    }
    return response;
}

export async function fetch_recurring_component_proposals(
    audit_id: string
): Promise<RecurringProposalResponse> {
    const url = `${get_base_url()}/audits/${encodeURIComponent(audit_id)}/snapshots/recurring-proposals`;
    const response = await authorized_fetch(url);
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return response.json() as Promise<RecurringProposalResponse>;
}
