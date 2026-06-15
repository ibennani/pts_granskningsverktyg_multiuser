/**
 * @file Proxy mot LLM-leverantörer (Ollama m.fl.) från servern.
 */

import {
    type LlmProvider,
    type LlmSettingsRow,
    validate_base_url,
    validate_provider,
    validate_timeout_ms
} from './llm_settings_validation.js';
import { format_llm_chat_error, resolve_chat_timeout_ms } from './llm_chat_timeout.js';

export interface LlmTestInput {
    provider?: unknown;
    base_url?: unknown;
    model?: unknown;
    timeout_ms?: unknown;
    api_key?: unknown;
}

export interface LlmConnectionResult {
    ok: boolean;
    status: 'connected' | 'unreachable' | 'disabled' | 'error';
    message: string;
    models: string[];
    model_available: boolean | null;
    provider: LlmProvider;
}

interface ResolvedTestConfig {
    provider: LlmProvider;
    base_url: string;
    model: string;
    timeout_ms: number;
    api_key: string | null;
}

function resolve_test_config(saved: LlmSettingsRow, input: LlmTestInput): ResolvedTestConfig {
    const provider = input.provider !== undefined ? validate_provider(input.provider) : saved.provider;
    const base_url = input.base_url !== undefined ? validate_base_url(provider, input.base_url) : saved.base_url;
    const model = input.model !== undefined ? String(input.model).trim() : saved.model;
    const timeout_ms = input.timeout_ms !== undefined ? validate_timeout_ms(input.timeout_ms) : saved.timeout_ms;
    let api_key = saved.api_key;
    if (input.api_key !== undefined) {
        const next = typeof input.api_key === 'string' ? input.api_key.trim() : '';
        if (next) api_key = next;
    }
    return { provider, base_url, model, timeout_ms, api_key };
}

function build_auth_headers(api_key: string | null): Record<string, string> {
    if (!api_key) return {};
    return { Authorization: `Bearer ${api_key}` };
}

async function fetch_ollama_tags(
    base_url: string,
    timeout_ms: number,
    api_key: string | null
): Promise<string[]> {
    const response = await fetch(`${base_url}/api/tags`, {
        signal: AbortSignal.timeout(timeout_ms),
        headers: build_auth_headers(api_key)
    });
    if (!response.ok) {
        throw new Error(`Ollama svarade med status ${response.status}.`);
    }
    const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
    return (data.models || []).map((m) => m.name || m.model || '').filter(Boolean);
}

export async function test_llm_connection(
    saved: LlmSettingsRow,
    input: LlmTestInput = {}
): Promise<LlmConnectionResult> {
    const config = resolve_test_config(saved, input);
    if (config.provider !== 'ollama') {
        return {
            ok: false,
            status: 'error',
            message: 'Endast Ollama stöds i testläge ännu.',
            models: [],
            model_available: null,
            provider: config.provider
        };
    }
    try {
        const models = await fetch_ollama_tags(config.base_url, config.timeout_ms, config.api_key);
        const model_available = config.model ? models.includes(config.model) : null;
        return {
            ok: true,
            status: 'connected',
            message: 'Anslutningen till Ollama lyckades.',
            models: models.slice(0, 50),
            model_available,
            provider: config.provider
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Kunde inte nå Ollama.';
        return {
            ok: false,
            status: 'unreachable',
            message,
            models: [],
            model_available: null,
            provider: config.provider
        };
    }
}

export async function get_llm_status(saved: LlmSettingsRow): Promise<LlmConnectionResult> {
    if (!saved.enabled) {
        return {
            ok: false,
            status: 'disabled',
            message: 'AI är inte aktiverad i inställningarna.',
            models: [],
            model_available: null,
            provider: saved.provider
        };
    }
    return test_llm_connection(saved, {
        provider: saved.provider,
        base_url: saved.base_url,
        model: saved.model,
        timeout_ms: saved.timeout_ms,
        api_key: saved.api_key
    });
}

export interface LlmAvailability {
    available: boolean;
    enabled: boolean;
}

export async function get_llm_availability(saved: LlmSettingsRow): Promise<LlmAvailability> {
    if (!saved.enabled || !String(saved.model || '').trim()) {
        return { available: false, enabled: saved.enabled };
    }
    const status = await get_llm_status(saved);
    return {
        available: status.ok === true,
        enabled: saved.enabled
    };
}

export interface LlmChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    thinking?: string;
    tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }>;
    tool_name?: string;
}

const LEFFE_SYSTEM_PROMPT =
    'Du heter Leffe och är en hjälpsam assistent i ett verktyg för digital tillsyn och tillgänglighetsgranskning. Svara på svenska om användaren inte skriver på ett annat språk. Var tydlig och saklig.';

export { LEFFE_SYSTEM_PROMPT };

async function post_ollama_chat(
    base_url: string,
    model: string,
    messages: LlmChatMessage[],
    timeout_ms: number,
    api_key: string | null
): Promise<string> {
    const response = await fetch(`${base_url}/api/chat`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeout_ms),
        headers: {
            'Content-Type': 'application/json',
            ...build_auth_headers(api_key)
        },
        body: JSON.stringify({
            model,
            messages,
            stream: false
        })
    });
    if (!response.ok) {
        throw new Error(`Ollama svarade med status ${response.status}.`);
    }
    const data = (await response.json()) as { message?: { content?: string } };
    const content = typeof data.message?.content === 'string' ? data.message.content.trim() : '';
    if (!content) {
        throw new Error('Ollama returnerade inget textsvar.');
    }
    return content;
}

export async function send_llm_chat(
    saved: LlmSettingsRow,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ content: string }> {
    if (!saved.enabled || !String(saved.model || '').trim()) {
        throw new Error('AI är inte tillgänglig just nu.');
    }
    if (saved.provider !== 'ollama') {
        throw new Error('Endast Ollama stöds för chatt ännu.');
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user') {
        throw new Error('Senaste meddelandet måste komma från användaren.');
    }
    const messages_for_api: LlmChatMessage[] = [
        { role: 'system', content: LEFFE_SYSTEM_PROMPT },
        ...messages
    ];
    try {
        const content = await post_ollama_chat(
            saved.base_url,
            saved.model,
            messages_for_api,
            resolve_chat_timeout_ms(saved.timeout_ms),
            saved.api_key
        );
        return { content };
    } catch (err) {
        throw new Error(format_llm_chat_error(err));
    }
}
