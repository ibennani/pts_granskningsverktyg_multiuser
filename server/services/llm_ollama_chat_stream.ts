/**
 * @file Strömmande chatt mot Ollama – vidarebefordrar NDJSON till klienten.
 */

import type { Response } from 'express';
import type { LlmSettingsRow } from './llm_settings_validation.js';
import { format_llm_chat_error, resolve_chat_timeout_ms } from './llm_chat_timeout.js';
import { type LlmChatMessage, LEFFE_SYSTEM_PROMPT } from './llm_proxy_service.js';

function build_auth_headers(api_key: string | null): Record<string, string> {
    if (!api_key) return {};
    return { Authorization: `Bearer ${api_key}` };
}

function prepare_chat_messages(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
): LlmChatMessage[] {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user') {
        throw new Error('Senaste meddelandet måste komma från användaren.');
    }
    return [{ role: 'system', content: LEFFE_SYSTEM_PROMPT }, ...messages];
}

function assert_chat_available(saved: LlmSettingsRow): void {
    if (!saved.enabled || !String(saved.model || '').trim()) {
        throw new Error('AI är inte tillgänglig just nu.');
    }
    if (saved.provider !== 'ollama') {
        throw new Error('Endast Ollama stöds för chatt ännu.');
    }
}

async function forward_ollama_body(
    ollama_body: ReadableStream<Uint8Array>,
    res: Response
): Promise<void> {
    const reader = ollama_body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (!line.trim()) continue;
            res.write(`${line}\n`);
        }
    }
    if (buffer.trim()) {
        res.write(`${buffer}\n`);
    }
}

export async function pipe_ollama_chat_stream(
    saved: LlmSettingsRow,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    res: Response,
    abort_signal?: AbortSignal
): Promise<void> {
    assert_chat_available(saved);
    const messages_for_api = prepare_chat_messages(messages);
    const timeout_ms = resolve_chat_timeout_ms(saved.timeout_ms);
    const ollama_response = await fetch(`${saved.base_url}/api/chat`, {
        method: 'POST',
        signal: abort_signal ?? AbortSignal.timeout(timeout_ms),
        headers: {
            'Content-Type': 'application/json',
            ...build_auth_headers(saved.api_key)
        },
        body: JSON.stringify({
            model: saved.model,
            messages: messages_for_api,
            stream: true
        })
    });
    if (!ollama_response.ok || !ollama_response.body) {
        throw new Error(`Ollama svarade med status ${ollama_response.status}.`);
    }
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    await forward_ollama_body(ollama_response.body, res);
    res.end();
}

export function format_stream_route_error(err: unknown): string {
    return format_llm_chat_error(err);
}
