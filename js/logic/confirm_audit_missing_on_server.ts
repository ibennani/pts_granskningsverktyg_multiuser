/**
 * @fileoverview Bekräftar via GET att en granskning saknas på servern innan «saknas»-modal visas.
 */

import { is_fetch_network_error } from './connectivity_service.js';

export type ApiErrorLike = {
    status?: number;
    message?: string;
};

export type ConfirmAuditMissingResult =
    | { confirmed: true }
    | { confirmed: false; reason: 'audit_exists' | 'inconclusive' | 'network' | 'no_audit_id' };

type GetAuditFn = (audit_id: string) => Promise<unknown>;

/** Sant om API-felet är 404 med standardtexten för saknad granskning. */
export function is_audit_not_found_api_error(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as ApiErrorLike;
    if (e.status !== 404) return false;
    return String(e.message || '').toLowerCase().includes('granskning hittades inte');
}

function classify_get_audit_error(err: unknown): ConfirmAuditMissingResult {
    if (is_fetch_network_error(err)) {
        return { confirmed: false, reason: 'network' };
    }
    if (is_audit_not_found_api_error(err)) {
        return { confirmed: true };
    }
    return { confirmed: false, reason: 'inconclusive' };
}

/**
 * Hämtar granskningen från servern. Bekräftar «saknas» endast vid verifierad 404.
 */
export async function confirm_audit_missing_on_server(
    audit_id: string | null | undefined,
    options: { get_audit?: GetAuditFn } = {}
): Promise<ConfirmAuditMissingResult> {
    const id = typeof audit_id === 'string' ? audit_id.trim() : '';
    if (!id) {
        return { confirmed: false, reason: 'no_audit_id' };
    }

    const get_audit_fn =
        options.get_audit ??
        (async (auditId: string) => {
            const { get_audit } = await import('../api/client.js');
            return get_audit(auditId);
        });

    try {
        await get_audit_fn(id);
        return { confirmed: false, reason: 'audit_exists' };
    } catch (err) {
        return classify_get_audit_error(err);
    }
}
