const AUDIT_UPDATES_CHANNEL_NAME = 'granskningsverktyget-audit-updates';

export function broadcast_audit_updated(audit_id) {
    if (!audit_id) return;
    try {
        if (typeof BroadcastChannel === 'undefined') return;
        const ch = new BroadcastChannel(AUDIT_UPDATES_CHANNEL_NAME);
        ch.postMessage({ type: 'audit-updated', auditId: String(audit_id) });
        ch.close();
    } catch (_) {
        // ignoreras medvetet
    }
}

