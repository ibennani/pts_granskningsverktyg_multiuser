/**
 * @fileoverview Sparar pågående granskning till servern innan hård omladdning.
 */

import { getState } from '../state.js';
import { get_api_base_url } from '../app/browser_globals.js';

/**
 * Försöker spara säkerhetskopia av aktiv granskning. Fel ignoreras så omladdning kan fortsätta.
 */
export async function save_audit_backup_before_reload(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
    }
    try {
        const state = getState();
        const audit_id = state?.auditId;
        if (!audit_id || !state?.ruleFileContent) {
            return;
        }
        const api_base = String(get_api_base_url()).replace(/\/$/, '');
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
            const token = typeof window !== 'undefined' && window.sessionStorage
                ? window.sessionStorage.getItem('gv_auth_token')
                : null;
            if (token) {
                headers = { ...headers, Authorization: `Bearer ${token}` };
            }
        } catch {
            /* sessionStorage otillgängligt */
        }
        await fetch(`${api_base}/backup/save-audit`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ auditId: audit_id })
        });
    } catch {
        /* fortsätt med omladdning */
    }
}
