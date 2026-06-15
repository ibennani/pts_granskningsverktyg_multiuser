/**
 * @file Tidsgränser och felmeddelanden för LLM-chatt.
 */

export const LLM_CHAT_TIMEOUT_MIN_MS = 300_000;
export const LLM_CHAT_TIMEOUT_MAX_MS = 600_000;

export function resolve_chat_timeout_ms(settings_timeout_ms: number): number {
    const base = Number.isFinite(settings_timeout_ms) ? settings_timeout_ms : LLM_CHAT_TIMEOUT_MIN_MS;
    return Math.min(Math.max(base, LLM_CHAT_TIMEOUT_MIN_MS), LLM_CHAT_TIMEOUT_MAX_MS);
}

export function format_llm_chat_error(err: unknown): string {
    const message = err instanceof Error ? err.message : '';
    if (/timeout|aborted/i.test(message)) {
        return 'Modellen hann inte svara inom tidsgränsen. Öka timeout under AI-inställningar eller välj en snabbare modell.';
    }
    return message || 'Kunde inte skicka chattmeddelande';
}
