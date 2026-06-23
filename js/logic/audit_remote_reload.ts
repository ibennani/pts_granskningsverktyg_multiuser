/**
 * @fileoverview Laddar om öppen granskning från servern när serverversion är nyare än lokal.
 * Används av polling och WebSocket-push så att status och övrigt innehåll hålls i synk mellan flikar.
 */

import { get_audit_version, load_audit_with_rule_file } from '../api/client.js';
import {
    should_show_audit_collaboration_notice,
    update_baseline_from_server_full_state
} from './audit_collaboration_notice.js';
import { should_reload_audit_from_server } from './audit_status_sync.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';

type AuditReloadState = {
    auditId?: string | null;
    auditStatus?: string;
    version?: number | null;
};

type ReloadDeps = {
    getState: () => AuditReloadState | null | undefined;
    dispatch: (action: { type: string; payload?: Record<string, unknown> }) => void;
    StoreActionTypes: { REPLACE_STATE_FROM_REMOTE: string };
};

type ReloadOpts = ReloadDeps & {
    remote_version_hint?: number | null;
    show_collaboration_notice?: boolean;
};

function show_remote_update_notice(local_state: AuditReloadState, remote_state: Record<string, unknown>): void {
    const should_notice = should_show_audit_collaboration_notice({
        local_state,
        remote_state
    });
    if (!should_notice) return;
    const notifier = app_runtime_refs.notification_component as {
        show_global_message?: (message: string, type: string) => void;
    } | null;
    const t = typeof window !== 'undefined' && window.Translation?.t;
    if (!notifier?.show_global_message || typeof t !== 'function') return;
    const msg = t('realtime_sync_updated') || 'Granskningen har uppdaterats av en annan enhet';
    notifier.show_global_message(msg, 'info');
}

/**
 * Hämtar granskning från servern om version är högre än lokal (eller hint säger det).
 * @returns true om state ersattes från servern
 */
export async function reload_open_audit_if_server_ahead(opts: ReloadOpts): Promise<boolean> {
    const state = opts.getState();
    const audit_id = state?.auditId;
    if (!audit_id || state?.auditStatus === 'rulefile_editing') return false;
    if (state.auditStatus === 'not_started' && !audit_id) return false;

    const local_version = state?.version ?? 0;
    let remote_version = opts.remote_version_hint;
    if (remote_version === null || remote_version === undefined) {
        try {
            const version_response = await get_audit_version(String(audit_id));
            remote_version = version_response?.version ?? null;
        } catch {
            return false;
        }
    }
    if (remote_version === null || remote_version === undefined || remote_version < local_version) {
        return false;
    }

    try {
        const full_state = await load_audit_with_rule_file(String(audit_id));
        if (!full_state?.samples) return false;
        const remote_status = typeof full_state.auditStatus === 'string' ? full_state.auditStatus : undefined;
        if (
            !should_reload_audit_from_server(
                state.auditStatus,
                remote_status,
                local_version,
                Number(remote_version)
            )
        ) {
            return false;
        }
        opts.dispatch({
            type: opts.StoreActionTypes.REPLACE_STATE_FROM_REMOTE,
            payload: {
                ...full_state,
                saveFileVersion: full_state.saveFileVersion || '2.1.0'
            }
        });
        update_baseline_from_server_full_state(full_state);
        if (opts.show_collaboration_notice !== false) {
            show_remote_update_notice(state, full_state as Record<string, unknown>);
        }
        return true;
    } catch {
        return false;
    }
}
