/**
 * @file Läser NDJSON-ström från LLM-chatt-endpoint och bygger ihop delsvaren.
 */

import { append_stream_text } from '../../shared/llm/llm_stream_text_append.ts';

export interface LlmChatStreamDelta {
    content: string;
    thinking: string;
    done: boolean;
    tool_activity: string | null;
}

export interface ParsedOllamaStreamLine {
    content?: string;
    thinking?: string;
    done?: boolean;
    error?: string;
    tool_activity?: string | null;
    content_reset?: boolean;
}

function parse_envelope_line(data: Record<string, unknown>): ParsedOllamaStreamLine | null {
    if (data._leffe === 'content_reset') {
        return { content_reset: true };
    }
    if (data._leffe === 'error' && typeof data.message === 'string') {
        return { error: data.message };
    }
    if (data._leffe !== 'tool') return null;
    if (data.phase === 'start' && typeof data.name === 'string') {
        return { tool_activity: data.name };
    }
    if (data.phase === 'end') {
        return { tool_activity: null };
    }
    return null;
}

export function parse_ollama_stream_line(line: string): ParsedOllamaStreamLine | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
        const data = JSON.parse(trimmed) as Record<string, unknown>;
        const envelope = parse_envelope_line(data);
        if (envelope) return envelope;
        const message = data.message as { content?: string; thinking?: string } | undefined;
        if (typeof data.error === 'string' && data.error) {
            return { error: data.error };
        }
        const content = typeof message?.content === 'string' ? message.content : '';
        const thinking = typeof message?.thinking === 'string' ? message.thinking : '';
        return {
            content,
            thinking,
            done: data.done === true
        };
    } catch {
        return null;
    }
}

function apply_parsed_line(
    parsed: ParsedOllamaStreamLine,
    state: { content: string; thinking: string; tool_activity: string | null }
): LlmChatStreamDelta | null {
    if (parsed.error) {
        throw new Error(parsed.error);
    }
    if (parsed.content_reset) {
        state.content = '';
        state.thinking = '';
    }
    if (parsed.tool_activity !== undefined) {
        state.tool_activity = parsed.tool_activity;
    }
    if (parsed.thinking) {
        state.thinking = append_stream_text(state.thinking, parsed.thinking);
    }
    if (parsed.content) {
        state.content = append_stream_text(state.content, parsed.content);
    }
    return {
        content: state.content,
        thinking: state.thinking,
        done: parsed.done === true,
        tool_activity: state.tool_activity
    };
}

function split_stream_buffer(buffer: string): { lines: string[]; rest: string } {
    const parts = buffer.split('\n');
    return { lines: parts.slice(0, -1), rest: parts[parts.length - 1] || '' };
}

export async function consume_llm_chat_stream(
    response: Response,
    on_delta: (delta: LlmChatStreamDelta) => void
): Promise<{ content: string; thinking: string }> {
    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const err = (await response.json()) as { error?: string };
            if (err.error) message = err.error;
        } catch {
            // Behåll HTTP-status som feltext.
        }
        throw new Error(message);
    }
    if (!response.body) {
        throw new Error('Inget svar från servern.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state = { content: '', thinking: '', tool_activity: null as string | null };
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { lines, rest } = split_stream_buffer(buffer);
        buffer = rest;
        for (const line of lines) {
            const parsed = parse_ollama_stream_line(line);
            if (!parsed) continue;
            const delta = apply_parsed_line(parsed, state);
            if (delta) on_delta(delta);
        }
    }
    if (buffer.trim()) {
        const parsed = parse_ollama_stream_line(buffer);
        if (parsed) {
            const delta = apply_parsed_line(parsed, state);
            if (delta) on_delta(delta);
        }
    }
    return { content: state.content.trim(), thinking: state.thinking.trim() };
}
