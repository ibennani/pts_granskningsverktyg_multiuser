/**
 * @file Agentloop: chatt med Ollama, verktygsanrop och strömmande svar till klienten.
 */

import type { Response } from 'express';
import type { LlmSettingsRow } from './llm_settings_validation.js';
import { resolve_chat_timeout_ms } from './llm_chat_timeout.js';
import { LLM_CHAT_TOOLS } from './llm_chat_tools_schema.js';
import { build_leffe_system_prompt } from './llm_chat_system_prompt.js';
import type { LlmToolContext } from './llm_tool_context.js';
import { execute_llm_tool } from './llm_tool_executor.js';
import type { LlmChatMessage } from './llm_proxy_service.js';

const MAX_AGENT_ROUNDS = 8;

export interface LlmStreamEnvelope {
    _leffe: 'tool' | 'error';
    phase?: 'start' | 'end';
    name?: string;
    ok?: boolean;
    message?: string;
}

type OllamaToolCall = {
    function?: { name?: string; arguments?: unknown };
};

type OllamaChatMessage = {
    role: string;
    content?: string;
    thinking?: string;
    tool_calls?: OllamaToolCall[];
    tool_name?: string;
};

function build_auth_headers(api_key: string | null): Record<string, string> {
    if (!api_key) return {};
    return { Authorization: `Bearer ${api_key}` };
}

function write_envelope(res: Response, envelope: LlmStreamEnvelope): void {
    res.write(`${JSON.stringify(envelope)}\n`);
}

function write_ollama_chunk(res: Response, chunk: Record<string, unknown>): void {
    res.write(`${JSON.stringify(chunk)}\n`);
}

function parse_stream_line(line: string): Record<string, unknown> | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function accumulate_tool_calls(target: OllamaToolCall[], incoming: OllamaToolCall[] | undefined): void {
    if (!incoming?.length) return;
    for (let i = 0; i < incoming.length; i += 1) {
        const call = incoming[i];
        if (!call?.function?.name) continue;
        const existing = target[i];
        if (!existing) {
            target[i] = call;
            continue;
        }
        const prev_args = existing.function?.arguments;
        const next_args = call.function?.arguments;
        target[i] = {
            function: {
                name: call.function.name || existing.function?.name,
                arguments:
                    typeof prev_args === 'string' && typeof next_args === 'string'
                        ? prev_args + next_args
                        : next_args ?? prev_args
            }
        };
    }
}

async function read_ollama_stream_body(
    body: ReadableStream<Uint8Array>,
    res: Response
): Promise<{ assistant_message: OllamaChatMessage; done: boolean }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let thinking = '';
    const tool_calls: OllamaToolCall[] = [];
    let done = false;

    while (true) {
        const { done: read_done, value } = await reader.read();
        if (read_done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const parsed = parse_stream_line(line);
            if (!parsed) continue;
            if (parsed.done === true) done = true;
            const message = parsed.message as OllamaChatMessage | undefined;
            if (!message) continue;
            if (message.thinking) thinking += message.thinking;
            if (message.content) content += message.content;
            accumulate_tool_calls(tool_calls, message.tool_calls);
            write_ollama_chunk(res, parsed);
        }
    }

    const assistant_message: OllamaChatMessage = { role: 'assistant', content, thinking };
    if (tool_calls.length) assistant_message.tool_calls = tool_calls;
    return { assistant_message, done: done || true };
}

async function post_ollama_chat_round(
    saved: LlmSettingsRow,
    messages: LlmChatMessage[],
    abort_signal: AbortSignal
): Promise<Response> {
    return fetch(`${saved.base_url}/api/chat`, {
        method: 'POST',
        signal: abort_signal,
        headers: {
            'Content-Type': 'application/json',
            ...build_auth_headers(saved.api_key)
        },
        body: JSON.stringify({
            model: saved.model,
            messages,
            stream: true,
            tools: LLM_CHAT_TOOLS
        })
    });
}

function prepare_messages(
    user_messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: LlmToolContext
): LlmChatMessage[] {
    return [{ role: 'system', content: build_leffe_system_prompt(context) }, ...user_messages];
}

async function run_tool_calls(
    tool_calls: OllamaToolCall[],
    context: LlmToolContext,
    res: Response,
    api_messages: LlmChatMessage[]
): Promise<void> {
    for (const call of tool_calls) {
        const name = call.function?.name || 'unknown';
        write_envelope(res, { _leffe: 'tool', phase: 'start', name });
        try {
            const result = await execute_llm_tool(name, call.function?.arguments, context);
            api_messages.push({ role: 'tool', content: result, tool_name: name } as LlmChatMessage);
            write_envelope(res, { _leffe: 'tool', phase: 'end', name, ok: true });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Verktyget misslyckades.';
            api_messages.push({
                role: 'tool',
                content: JSON.stringify({ ok: false, error: message }),
                tool_name: name
            } as LlmChatMessage);
            write_envelope(res, { _leffe: 'tool', phase: 'end', name, ok: false, message });
        }
    }
}

export async function pipe_ollama_agent_stream(
    saved: LlmSettingsRow,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: LlmToolContext,
    res: Response,
    abort_signal: AbortSignal
): Promise<void> {
    if (!saved.enabled || !String(saved.model || '').trim()) {
        throw new Error('AI är inte tillgänglig just nu.');
    }
    const api_messages = prepare_messages(messages, context);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
        const ollama_response = await post_ollama_chat_round(saved, api_messages, abort_signal);
        if (!ollama_response.ok || !ollama_response.body) {
            throw new Error(`Ollama svarade med status ${ollama_response.status}.`);
        }
        const { assistant_message } = await read_ollama_stream_body(ollama_response.body, res);
        api_messages.push(assistant_message as LlmChatMessage);
        const tool_calls = assistant_message.tool_calls || [];
        if (!tool_calls.length) break;
        await run_tool_calls(tool_calls, context, res, api_messages);
    }
    res.end();
}
