/**
 * @fileoverview Bilaga 3 malltexter: fast rubrik och redigerbar introtext.
 */
import default_sv from '../../shared/report_templates/appendix3_default_sv.json';
import {
    apply_appendix1_placeholders,
    build_appendix1_placeholder_context,
    type Appendix1AuditSlice,
} from './appendix1_sections.js';

export type Appendix3RulefileSlice = {
    appendix3?: {
        introText?: unknown;
    };
};

export type Appendix3ResolvedTemplate = {
    title: string;
    introText: string;
};

const DEFAULT_TITLE = (default_sv as { title: string }).title;
const DEFAULT_INTRO = (default_sv as { introText: string }).introText ?? '';

export function normalize_rulefile_appendix3<T extends Record<string, unknown>>(rule_file: T): T {
    const base = { ...rule_file };
    const appendix_raw = base.appendix3;

    const appendix_obj =
        appendix_raw && typeof appendix_raw === 'object' && !Array.isArray(appendix_raw)
            ? { ...(appendix_raw as Record<string, unknown>) }
            : {};

    delete appendix_obj.title;

    const intro = appendix_obj.introText;
    appendix_obj.introText = typeof intro === 'string' ? intro : DEFAULT_INTRO;

    (base as Record<string, unknown>).appendix3 = appendix_obj;
    return base;
}

export function read_rulefile_appendix3_template(
    rule_file_content: Appendix3RulefileSlice | null | undefined
): Appendix3ResolvedTemplate {
    const raw = rule_file_content?.appendix3;
    const introText = typeof raw?.introText === 'string' ? raw.introText : DEFAULT_INTRO;
    return { title: DEFAULT_TITLE, introText };
}

export function resolve_appendix3_screenshots_template(
    audit: Appendix1AuditSlice | null | undefined
): Appendix3ResolvedTemplate {
    const template = read_rulefile_appendix3_template(
        audit?.ruleFileContent as Appendix3RulefileSlice | null | undefined
    );
    const context = build_appendix1_placeholder_context(audit);
    return {
        title: apply_appendix1_placeholders(template.title, context),
        introText: apply_appendix1_placeholders(template.introText, context),
    };
}
