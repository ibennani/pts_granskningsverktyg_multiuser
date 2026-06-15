/**
 * @file Hjälp för strömmande LLM-text – hanterar både deltoken och kumulativ text.
 */

/**
 * Lägger till strömmande text oavsett om källan skickar deltoken eller kumulativ text hittills.
 */
export function append_stream_text(previous: string, chunk: string): string {
    if (!chunk) return previous;
    if (previous && chunk.startsWith(previous)) return chunk;
    if (previous && chunk.length <= previous.length && previous.endsWith(chunk)) return previous;
    return previous + chunk;
}
