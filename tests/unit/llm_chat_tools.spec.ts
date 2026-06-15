/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { build_leffe_system_prompt } from '../../server/services/llm_chat_system_prompt.ts';
import { summarize_requirement_results } from '../../server/services/llm_tool_summaries.ts';
import { parse_ollama_stream_line } from '../../js/logic/llm_chat_stream_reader.ts';

describe('llm_chat_system_prompt', () => {
    test('build_leffe_system_prompt nämner verktyg och öppen granskning', () => {
        const prompt = build_leffe_system_prompt({
            user: { id: 'u1', name: 'Anna', is_admin: true },
            client: { audit_id: 'audit-1', rule_set_id: null }
        });
        expect(prompt).toMatch(/verktyg/i);
        expect(prompt).toMatch(/audit-1/);
        expect(prompt).toMatch(/Anna/);
    });
});

describe('llm_tool_summaries', () => {
    test('summarize_requirement_results räknar status', () => {
        const summary = summarize_requirement_results({
            req1: { status: 'passed' },
            req2: { status: 'failed' },
            req3: { status: 'passed' }
        });
        expect(summary.total).toBe(3);
        expect(summary.by_status.passed).toBe(2);
        expect(summary.by_status.failed).toBe(1);
    });
});

describe('llm_chat_stream_reader envelopes', () => {
    test('parse_ollama_stream_line läser verktygskuvert', () => {
        const parsed = parse_ollama_stream_line(
            JSON.stringify({ _leffe: 'tool', phase: 'start', name: 'list_audits' })
        );
        expect(parsed?.tool_activity).toBe('list_audits');
    });
});
