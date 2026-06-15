/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { append_stream_text } from '../../shared/llm/llm_stream_text_append.ts';

describe('append_stream_text', () => {
    test('lägger till deltoken', () => {
        expect(append_stream_text('Hej', '!')).toBe('Hej!');
    });

    test('tar emot kumulativ text', () => {
        expect(append_stream_text('Hej', 'Hej där')).toBe('Hej där');
    });

    test('ignorerar upprepat deltoken', () => {
        expect(append_stream_text('Hej', 'j')).toBe('Hej');
    });
});
