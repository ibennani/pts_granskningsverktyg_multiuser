/**
 * @file Utvecklingslogg för AI-chatt i webbläsarens konsol.
 */

function is_ai_chat_debug_enabled(): boolean {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') return true;
    return false;
}

export function ai_chat_debug_log(event: string, detail?: Record<string, unknown>): void {
    if (!is_ai_chat_debug_enabled()) return;
    if (detail && Object.keys(detail).length > 0) {
        console.log(`[ai-chat] ${event}`, detail);
        return;
    }
    console.log(`[ai-chat] ${event}`);
}
