/**
 * @fileoverview Enhetlig innehållstypdetektering: regexp (HTML) ELLER CSS-selector (renderad DOM).
 */

import {
    compile_content_type_detection_pattern,
    type ContentTypeDetectionPatternRule,
} from './content_type_detection_pattern.js';
import {
    count_selector_matches_in_document,
    type ContentTypeDetectionSelectorRule,
    try_compile_content_type_detection_selector,
} from './content_type_detection_selector.js';

export type ContentTypeDetectionRule = {
    id: string;
    pattern?: string;
    selector?: string;
};

export type ContentTypeDetectionResult = {
    contentTypeId: string;
    detected: boolean;
    methods: Array<'regex' | 'selector'>;
    regexMatched: boolean;
    selectorMatched: boolean;
    selectorMatchCount: number;
};

function test_regex_on_html(html: string, pattern: string): boolean {
    const regex = compile_content_type_detection_pattern(pattern);
    if (!regex) return false;
    try {
        return regex.test(html);
    } catch {
        return false;
    }
}

/**
 * Detekterar innehållstyper från HTML och/eller renderad DOM.
 * En träff från regex eller selector räcker för detected=true.
 */
export function detect_content_types_runtime(input: {
    html?: string;
    document_ref?: { querySelectorAll: (sel: string) => { length: number } } | null;
    rules: ContentTypeDetectionRule[];
}): ContentTypeDetectionResult[] {
    const html = String(input.html || '');
    const results: ContentTypeDetectionResult[] = [];

    for (const rule of input.rules) {
        const id = String(rule.id || '').trim();
        if (!id) continue;

        const pattern = String(rule.pattern || '').trim();
        const selector = String(rule.selector || '').trim();
        const regex_matched = pattern ? test_regex_on_html(html, pattern) : false;
        let selector_match_count = 0;
        let selector_matched = false;

        if (selector && input.document_ref) {
            selector_match_count = count_selector_matches_in_document(input.document_ref, selector);
            selector_matched = selector_match_count > 0;
        }

        const detected = regex_matched || selector_matched;
        const methods: Array<'regex' | 'selector'> = [];
        if (regex_matched) methods.push('regex');
        if (selector_matched) methods.push('selector');

        results.push({
            contentTypeId: id,
            detected,
            methods,
            regexMatched: regex_matched,
            selectorMatched: selector_matched,
            selectorMatchCount: selector_match_count,
        });
    }

    return results;
}

/**
 * Returnerar ID:n för detekterade typer.
 */
export function detect_content_type_ids_runtime(input: {
    html?: string;
    document_ref?: { querySelectorAll: (sel: string) => { length: number } } | null;
    pattern_rules: ContentTypeDetectionPatternRule[];
    selector_rules: ContentTypeDetectionSelectorRule[];
}): string[] {
    const merged = new Map<string, ContentTypeDetectionRule>();
    for (const r of input.pattern_rules) {
        merged.set(r.id, { id: r.id, pattern: r.pattern, selector: merged.get(r.id)?.selector });
    }
    for (const r of input.selector_rules) {
        const prev = merged.get(r.id);
        merged.set(r.id, { id: r.id, pattern: prev?.pattern, selector: r.selector });
    }

    return detect_content_types_runtime({
        html: input.html,
        document_ref: input.document_ref,
        rules: [...merged.values()],
    })
        .filter((r) => r.detected)
        .map((r) => r.contentTypeId)
        .sort();
}

export function merge_pattern_and_selector_rules(
    pattern_rules: ContentTypeDetectionPatternRule[],
    selector_rules: ContentTypeDetectionSelectorRule[]
): ContentTypeDetectionRule[] {
    const merged = new Map<string, ContentTypeDetectionRule>();
    for (const r of pattern_rules) {
        merged.set(r.id, { id: r.id, pattern: r.pattern });
    }
    for (const r of selector_rules) {
        const prev = merged.get(r.id);
        merged.set(r.id, { id: r.id, pattern: prev?.pattern, selector: r.selector });
    }
    return [...merged.values()];
}

export function is_selector_rule_usable(selector: string): boolean {
    return try_compile_content_type_detection_selector(selector) !== null;
}
