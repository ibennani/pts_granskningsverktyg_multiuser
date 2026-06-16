/**
 * @file Avgör om LLM-svar är för kort eller uppenbart ofullständigt.
 */

const STUB_REPLY_PATTERN = /^(here|ok|okay|sure|yes|ja|nej|hmm|thanks|thank you)\.?$/i;

export function is_inadequate_chat_reply(text: string): boolean {
    const trimmed = (text || '').trim();
    if (!trimmed) return true;
    if (trimmed.length < 20) return true;
    if (STUB_REPLY_PATTERN.test(trimmed)) return true;
    return false;
}
