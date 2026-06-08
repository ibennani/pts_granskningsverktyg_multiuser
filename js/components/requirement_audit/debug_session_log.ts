/**
 * @fileoverview Temporär sessionslogg för felsökning av klick/omrendering i krav-vyn.
 */

const DEBUG_ENDPOINT = 'http://127.0.0.1:7361/ingest/2fc1a7e9-a75d-4471-982b-aab871f3ce49';
const DEBUG_SESSION_ID = '173661';

function brief_active_element(): Record<string, unknown> | null {
    if (typeof document === 'undefined') return null;
    const el = document.activeElement;
    if (!el || !(el instanceof Element)) return null;
    return {
        tag: el.tagName?.toLowerCase() || null,
        id: el.id || null,
        action: el.getAttribute?.('data-action') || null
    };
}

/** Skickar en NDJSON-rad till debug-servern (no-op vid fel). */
export function debug_session_log(
    location: string,
    message: string,
    data: Record<string, unknown> = {},
    hypothesis_id = ''
): void {
    const payload = {
        sessionId: DEBUG_SESSION_ID,
        location,
        message,
        data: {
            active_element: brief_active_element(),
            ...data
        },
        hypothesisId: hypothesis_id,
        timestamp: Date.now(),
        runId: 'pre-fix'
    };
    // #region agent log
    if (typeof window !== 'undefined') {
        const w = window as Window & { __DEBUG_SESSION_173661__?: unknown[] };
        if (!Array.isArray(w.__DEBUG_SESSION_173661__)) {
            w.__DEBUG_SESSION_173661__ = [];
        }
        w.__DEBUG_SESSION_173661__.push(payload);
        if (w.__DEBUG_SESSION_173661__.length > 200) {
            w.__DEBUG_SESSION_173661__.shift();
        }
    }
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[DEBUG-173661]', message, payload);
    }
    fetch(DEBUG_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': DEBUG_SESSION_ID
        },
        body: JSON.stringify(payload)
    }).catch(() => {});
    // #endregion
}
