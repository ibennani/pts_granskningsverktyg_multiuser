/**
 * @fileoverview Kör den aktiva granskningens redigerbara DOM-selectorer mot aktuell renderad sida.
 */
import path from 'node:path';
import type { Page } from 'puppeteer';
import { get_audit_content_type_detection_rules } from '../../../services/audit_content_type_detection_rules.js';

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

function resolve_audit_id_from_temp_dir(temp_dir: string): string {
    return path.basename(path.dirname(path.resolve(temp_dir)));
}

export async function collect_content_type_selector_evidence(
    page: Page,
    temp_dir: string
): Promise<ContentTypeSelectorDetectionResult> {
    const audit_id = resolve_audit_id_from_temp_dir(temp_dir);
    const rules = await get_audit_content_type_detection_rules(audit_id);
    const evidence: ContentTypeSelectorEvidence[] = [];

    for (const rule of rules) {
        try {
            const count = await page.$$eval(rule.selector, (elements) => elements.length);
            evidence.push({
                contentTypeId: rule.id,
                selector: rule.selector,
                selectorMatched: count > 0,
                selectorMatchCount: count,
                selectorError: null,
            });
        } catch (error) {
            evidence.push({
                contentTypeId: rule.id,
                selector: rule.selector,
                selectorMatched: false,
                selectorMatchCount: 0,
                selectorError: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return {
        detectedContentTypeIds: [...new Set(
            evidence.filter((item) => item.selectorMatched).map((item) => item.contentTypeId)
        )],
        evidence,
        ruleCount: rules.length,
    };
}
