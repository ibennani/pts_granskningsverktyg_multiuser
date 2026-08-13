/**
 * @fileoverview Kör den aktiva granskningens redigerbara DOM-selectorer mot aktuell renderad sida eller avgränsade block.
 */
import path from 'node:path';
import type { Page } from 'puppeteer';
import { get_audit_content_type_detection_rules } from '../../../services/audit_content_type_detection_rules.js';
import type { ContentTypeDetectionSelectorRule } from '../../../../shared/rulefile/content_type_detection_selector.js';

export type ContentTypeSelectorEvidence = {
    contentTypeId: string;
    selector: string;
    selectorMatched: boolean;
    selectorMatchCount: number;
    selectorError: string | null;
};

export type ContentTypeSelectorDetectionResult = {
    detectedContentTypeIds: string[];
    evidence: ContentTypeSelectorEvidence[];
    ruleCount: number;
};

export type ContentTypeDetectionRoot = {
    key: string;
    domPath: string;
};

export type ContentTypeDetectionByRoot = {
    key: string;
    domPath: string;
    detectedContentTypeIds: string[];
    evidence: ContentTypeSelectorEvidence[];
};

function resolve_audit_id_from_temp_dir(temp_dir: string): string {
    return path.basename(path.dirname(path.resolve(temp_dir)));
}

async function load_rules(temp_dir: string): Promise<ContentTypeDetectionSelectorRule[]> {
    return get_audit_content_type_detection_rules(resolve_audit_id_from_temp_dir(temp_dir));
}

async function evaluate_rule_on_page(
    page: Page,
    rule: ContentTypeDetectionSelectorRule
): Promise<ContentTypeSelectorEvidence> {
    try {
        const count = await page.$$eval(rule.selector, (elements) => elements.length);
        return {
            contentTypeId: rule.id,
            selector: rule.selector,
            selectorMatched: count > 0,
            selectorMatchCount: count,
            selectorError: null,
        };
    } catch (error) {
        return {
            contentTypeId: rule.id,
            selector: rule.selector,
            selectorMatched: false,
            selectorMatchCount: 0,
            selectorError: error instanceof Error ? error.message : String(error),
        };
    }
}

async function evaluate_rule_in_root(
    page: Page,
    root_selector: string,
    rule: ContentTypeDetectionSelectorRule
): Promise<ContentTypeSelectorEvidence> {
    try {
        const count = await page.evaluate(
            ({ rootSelector, selector }) => {
                const root = document.querySelector(rootSelector);
                if (!root) return 0;
                let matches = 0;
                try {
                    if (root.matches(selector)) matches += 1;
                    matches += root.querySelectorAll(selector).length;
                    return matches;
                } catch {
                    return -1;
                }
            },
            { rootSelector: root_selector, selector: rule.selector }
        );
        if (count < 0) throw new Error('Ogiltig CSS-selector');
        return {
            contentTypeId: rule.id,
            selector: rule.selector,
            selectorMatched: count > 0,
            selectorMatchCount: count,
            selectorError: null,
        };
    } catch (error) {
        return {
            contentTypeId: rule.id,
            selector: rule.selector,
            selectorMatched: false,
            selectorMatchCount: 0,
            selectorError: error instanceof Error ? error.message : String(error),
        };
    }
}

function build_result(
    rules: ContentTypeDetectionSelectorRule[],
    evidence: ContentTypeSelectorEvidence[]
): ContentTypeSelectorDetectionResult {
    return {
        detectedContentTypeIds: [...new Set(
            evidence.filter((item) => item.selectorMatched).map((item) => item.contentTypeId)
        )],
        evidence,
        ruleCount: rules.length,
    };
}

export async function collect_content_type_selector_evidence(
    page: Page,
    temp_dir: string
): Promise<ContentTypeSelectorDetectionResult> {
    const rules = await load_rules(temp_dir);
    const evidence: ContentTypeSelectorEvidence[] = [];
    for (const rule of rules) evidence.push(await evaluate_rule_on_page(page, rule));
    return build_result(rules, evidence);
}

export async function collect_content_type_selector_evidence_by_root(
    page: Page,
    temp_dir: string,
    roots: ContentTypeDetectionRoot[]
): Promise<ContentTypeDetectionByRoot[]> {
    const rules = await load_rules(temp_dir);
    const results: ContentTypeDetectionByRoot[] = [];
    for (const root of roots) {
        const evidence: ContentTypeSelectorEvidence[] = [];
        for (const rule of rules) evidence.push(await evaluate_rule_in_root(page, root.domPath, rule));
        results.push({
            key: root.key,
            domPath: root.domPath,
            detectedContentTypeIds: build_result(rules, evidence).detectedContentTypeIds,
            evidence,
        });
    }
    return results;
}
