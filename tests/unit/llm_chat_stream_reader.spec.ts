/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { TextEncoder } from 'util';
import {
    parse_ollama_stream_line,
    consume_llm_chat_stream
} from '../../js/logic/llm_chat_stream_reader.ts';

describe('llm_chat_stream_reader', () => {
    test('parse_ollama_stream_line läser innehåll och thinking', () => {
        const parsed = parse_ollama_stream_line(
            JSON.stringify({ message: { thinking: 'Hmm', content: 'Hej' }, done: false })
        );
        expect(parsed?.thinking).toBe('Hmm');
        expect(parsed?.content).toBe('Hej');
    });

    test('consume_llm_chat_stream bygger ihop delsvaren', async () => {
        const chunks = [
            `${JSON.stringify({ message: { thinking: 'Tänker' }, done: false })}\n`,
            `${JSON.stringify({ message: { content: 'Hej' }, done: false })}\n`,
            `${JSON.stringify({ message: { content: '!' }, done: true })}\n`
        ];
        const encoder = new TextEncoder();
        let index = 0;
        const body = new ReadableStream({
            pull(controller) {
                if (index >= chunks.length) {
                    controller.close();
                    return;
                }
                controller.enqueue(encoder.encode(chunks[index]));
                index += 1;
            }
        });
        const response = new Response(body, { status: 200 });
        const deltas: string[] = [];
        const result = await consume_llm_chat_stream(response, (delta) => {
            deltas.push(delta.content);
        });
        expect(result.thinking).toBe('Tänker');
        expect(result.content).toBe('Hej!');
        expect(deltas[deltas.length - 1]).toBe('Hej!');
    });
});
