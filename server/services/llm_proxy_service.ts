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
