/**
 * @fileoverview Fas 1 – automatisk innehållstypdetektering i sidrapport (regexp + selector).
 */
import fs from 'fs/promises';
import path from 'path';
import type { Page } from 'puppeteer';
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import {
    collect_child_detection_patterns_from_groups,
} from '../../../../shared/rulefile/content_type_detection_pattern.js';
import {
    collect_child_detection_selectors_from_groups,
    try_compile_content_type_detection_selector,
} from '../../../../shared/rulefile/content_type_detection_selector.js';
import {
    detect_content_types_runtime,
    type ContentTypeDetectionResult,
} from '../../../../shared/rulefile/content_type_detection_runtime.js';
import { apply_detection_patterns_to_content_types } from '../../../../shared/rulefile/content_type_detection_pattern_rulefile_apply.js';

type ContentTypeGroup = {
    types?: Array<{ id?: string; text?: string; detectionPattern?: string; detectionSelector?: string }>;
};

async function read_html_from_temp(temp_dir: string): Promise<string> {
    for (const rel of ['source.html', 'rendered.html']) {
        try {
            return await fs.readFile(path.join(temp_dir, rel), 'utf8');
        } catch {
            // nästa
        }
    }
    return '';
}

function resolve_groups_from_context(ctx: AnalysisContext): ContentTypeGroup[] {
    const raw = ctx.shared.content_type_groups as ContentTypeGroup[] | undefined;
    if (Array.isArray(raw) && raw.length > 0) {
        return apply_detection_patterns_to_content_types(raw, 'web');
    }
    return [];
}

async function count_selector_matches_on_page(page: Page, selector: string): Promise<number> {
    const compiled = try_compile_content_type_detection_selector(selector);
    if (!compiled) return 0;
    return await page.evaluate((sel) => {
        try {
            return document.querySelectorAll(sel).length;
        } catch {
            return 0;
        }
    }, compiled);
}

async function detect_content_types_with_page(
    html: string,
    page: Page,
    rules: Array<{ id: string; pattern?: string; selector?: string }>
): Promise<ContentTypeDetectionResult[]> {
    const regex_results = detect_content_types_runtime({
        html,
        document_ref: null,
        rules,
    });

    const results: ContentTypeDetectionResult[] = [];
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const regex_row = regex_results[i];
        const selector = String(rule.selector || '').trim();
        let selector_match_count = 0;
        if (selector) {
            selector_match_count = await count_selector_matches_on_page(page, selector);
        }
        const selector_matched = selector_match_count > 0;
        const regex_matched = regex_row?.regexMatched ?? false;
        const detected = regex_matched || selector_matched;
        const methods: Array<'regex' | 'selector'> = [];
        if (regex_matched) methods.push('regex');
        if (selector_matched) methods.push('selector');

        results.push({
            contentTypeId: rule.id,
            detected,
            methods,
            regexMatched: regex_matched,
            selectorMatched: selector_matched,
            selectorMatchCount: selector_match_count,
        });
    }
    return results;
}

export async function run_content_type_detection_analysis(
    ctx: AnalysisContext
): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const groups = resolve_groups_from_context(ctx);
    const pattern_rules = collect_child_detection_patterns_from_groups(groups);
    const selector_rules = collect_child_detection_selectors_from_groups(groups);
    const html = await read_html_from_temp(ctx.temp_dir);

    const merged_rules = pattern_rules.map((p) => ({
        id: p.id,
        pattern: p.pattern,
        selector: selector_rules.find((s) => s.id === p.id)?.selector,
    }));
    for (const s of selector_rules) {
        if (!merged_rules.some((r) => r.id === s.id)) {
            merged_rules.push({ id: s.id, pattern: '', selector: s.selector });
        }
    }

    const results: ContentTypeDetectionResult[] =
        merged_rules.length > 0
            ? await detect_content_types_with_page(html, ctx.page, merged_rules)
            : [];

    const detected_count = results.filter((r) => r.detected).length;
    return {
        module: 'content-types',
        version: 1,
        phase: 1,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: detected_count,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: {
            detectedAt: new Date().toISOString(),
            results,
            detectedContentTypeIds: results.filter((r) => r.detected).map((r) => r.contentTypeId),
        },
    };
}
