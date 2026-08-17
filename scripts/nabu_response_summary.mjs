/**
 * Extraherar kort avslutande sammanfattning från agentsvarstext.
 */

export const GENERIC_BESKRIVNING = 'Öppna Cursor och läs senaste svaret.';
export const MAX_SUMMARY_LENGTH = 280;

const GENERIC_PATTERNS = [
    /^jag kör notisen/i,
    /^notify_done/i,
    /^öppna cursor/i,
];

const FOLLOW_UP_PATTERNS = [
    /^säg till om du/i,
    /^vill du att jag/i,
    /^vill du kan jag/i,
    /^om du vill/i,
    /^säg till om/i,
    /^meddela om du/i,
];

/**
 * Återställer text som felaktigt lästs som Latin-1 i stället för UTF-8.
 * @param {string} text
 * @returns {string}
 */
export function repair_utf8_mojibake(text) {
    if (!text || !/[ÃÂâ€]/.test(text)) {
        return text;
    }
    const repaired = Buffer.from(text, 'latin1').toString('utf8');
    if (repaired.includes('\uFFFD')) {
        return text;
    }
    return repaired;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function is_generic_summary(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed === GENERIC_BESKRIVNING) {
        return true;
    }
    return GENERIC_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function has_mojibake(text) {
    return /Ã.|Â.|â€|â–/.test(text);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function is_unsuitable_summary(text) {
    const trimmed = text.trim();
    if (!trimmed) {
        return true;
    }
    if (is_follow_up_prompt(trimmed)) {
        return true;
    }
    if (has_mojibake(trimmed)) {
        return true;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
        return true;
    }
    if (/\*\*[^*]+\*\*/.test(trimmed)) {
        return true;
    }
    if (trimmed.includes('|') && trimmed.includes('---')) {
        return true;
    }
    if (/^\d+\.?$/.test(trimmed)) {
        return true;
    }
    if (trimmed.length < 12) {
        return true;
    }
    return false;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function is_follow_up_prompt(text) {
    const trimmed = text.trim();
    if (!trimmed) {
        return true;
    }
    if (trimmed.endsWith('?')) {
        return true;
    }
    if (trimmed.endsWith(':')) {
        return true;
    }
    return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function trim_summary(text) {
    const trimmed = text.trim();
    if (is_generic_summary(trimmed) || is_follow_up_prompt(trimmed) || is_unsuitable_summary(trimmed)) {
        return null;
    }
    if (trimmed.length > MAX_SUMMARY_LENGTH) {
        const cut = trimmed.slice(0, MAX_SUMMARY_LENGTH);
        const last_space = cut.lastIndexOf(' ');
        if (last_space > 60) {
            return cut.slice(0, last_space).trim();
        }
        return cut.trim();
    }
    return trimmed;
}

/**
 * @param {string} candidate
 * @returns {string[]}
 */
function split_sentences(candidate) {
    return (candidate.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [candidate])
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

/**
 * @param {string} candidate
 * @returns {string | null}
 */
function pick_best_summary_sentence(candidate) {
    const sentences = split_sentences(candidate);
    for (let i = sentences.length - 1; i >= 0; i -= 1) {
        const trimmed = trim_summary(sentences[i]);
        if (trimmed) {
            return trimmed;
        }
    }
    return trim_summary(candidate);
}

/**
 * @param {string} raw_text
 * @returns {boolean}
 */
export function response_looks_like_agent_completion(raw_text) {
    const text = repair_utf8_mojibake(raw_text || '').trim();
    if (!text) {
        return false;
    }
    if (text.length > 900) {
        return false;
    }
    const heading_count = (text.match(/^#{1,3}\s+/gm) || []).length;
    if (heading_count >= 2) {
        return false;
    }
    if (heading_count >= 1 && text.length > 400) {
        return false;
    }
    return true;
}

/**
 * @param {string} raw_text
 * @returns {string | null}
 */
export function extract_concluding_summary(raw_text) {
    if (!raw_text?.trim()) {
        return null;
    }

    const normalized = repair_utf8_mojibake(raw_text);
    const without_code = normalized.replace(/```[\s\S]*?```/g, '\n');
    const paragraphs = without_code
        .split(/\n\s*\n/)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .filter((part) => part.length > 0 && !/^#{1,6}\s/.test(part));

    for (let i = paragraphs.length - 1; i >= 0; i -= 1) {
        const picked = pick_best_summary_sentence(paragraphs[i]);
        if (picked) {
            return picked;
        }
    }

    return pick_best_summary_sentence(without_code.replace(/\s+/g, ' ').trim());
}
