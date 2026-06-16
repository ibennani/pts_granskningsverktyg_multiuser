/**
 * @file Strukturerad loggning för LLM-chatt (utveckling och felsökning).
 */

const LOG_PREFIX = '[llm-chat]';

function is_llm_chat_log_enabled(): boolean {
    if (process.env.LLM_CHAT_DEBUG === '1') return true;
    return process.env.NODE_ENV !== 'production';
}

function preview_text(text: string, max = 160): string {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!trimmed) return '(tom)';
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max)}…`;
}

function write_log(message: string): void {
    if (!is_llm_chat_log_enabled()) return;
    console.log(`${LOG_PREFIX} ${message}`);
}

export function log_llm_chat_start(params: {
    user_id: string;
    user_name: string;
    model: string;
    message_count: number;
    last_user_message: string;
}): void {
    write_log(
        `Start user=${params.user_name} (${params.user_id}) model=${params.model} ` +
            `messages=${params.message_count} fråga="${preview_text(params.last_user_message)}"`
    );
}

export function log_llm_agent_round(params: {
    round: number;
    use_tools: boolean;
    content_chars: number;
    thinking_chars: number;
    tool_names: string[];
    reply_preview: string;
}): void {
    const tools = params.tool_names.length ? params.tool_names.join(', ') : 'inga';
    write_log(
        `Runda ${params.round + 1} verktyg=${params.use_tools ? 'ja' : 'nej'} ` +
            `content=${params.content_chars} thinking=${params.thinking_chars} ` +
            `verktygsanrop=[${tools}] svar="${preview_text(params.reply_preview, 80)}"`
    );
}

export function log_llm_tool_execution(params: {
    name: string;
    args_preview: string;
    ok: boolean;
    result_chars: number;
    error?: string;
}): void {
    const status = params.ok ? 'ok' : 'fel';
    const extra = params.ok
        ? `resultat=${params.result_chars} tecken`
        : `fel="${preview_text(params.error || 'okänt', 80)}"`;
    write_log(
        `Verktyg ${params.name} ${status} args=${params.args_preview} ${extra}`
    );
}

export function log_llm_synthesis_attempt(params: { ok: boolean; reply_chars: number; reply_preview: string }): void {
    write_log(
        `Syntesrunda ${params.ok ? 'klar' : 'misslyckades'} ` +
            `svar=${params.reply_chars} tecken "${preview_text(params.reply_preview, 100)}"`
    );
}

export function log_llm_chat_finish(params: {
    finished: boolean;
    rounds: number;
    reply_chars: number;
    reply_preview: string;
}): void {
    const status = params.finished ? 'klar' : 'inget svar';
    write_log(
        `Slut ${status} efter ${params.rounds} runda/rundor ` +
            `svar=${params.reply_chars} tecken "${preview_text(params.reply_preview)}"`
    );
}

export function log_llm_chat_error(context: string, err: unknown): void {
    if (!is_llm_chat_log_enabled()) return;
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`${LOG_PREFIX} ${context}: ${message}`);
}

export function preview_tool_args(raw: unknown, max = 120): string {
    let text = '';
    if (typeof raw === 'string') text = raw;
    else {
        try {
            text = JSON.stringify(raw ?? {});
        } catch {
            text = String(raw);
        }
    }
    return preview_text(text, max);
}
