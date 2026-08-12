/**
 * @fileoverview Fas 2.3 – formulärinventering.
 */
import type { AnalysisContext, AnalysisModuleEnvelope } from '../snapshot_analysis_types.js';
import { build_element_identity_from_eval } from '../snapshot_element_identity.js';

const RISKY_FORM_KEYWORDS = ['login', 'password', 'checkout', 'payment', 'credit', 'ssn', 'personnummer'];

export async function run_form_analysis(ctx: AnalysisContext): Promise<AnalysisModuleEnvelope> {
    const started = Date.now();
    const forms = await ctx.page.evaluate(() => {
        return Array.from(document.querySelectorAll('form, input, select, textarea')).map((el) => {
            const html_el = el as HTMLElement;
            const tag = el.tagName.toLowerCase();
            const form = el.closest('form');
            const form_action = form ? (form as HTMLFormElement).action : null;
            const label_el = html_el.id
                ? document.querySelector(`label[for="${CSS.escape(html_el.id)}"]`)
                : null;
            let validity: Record<string, unknown> | null = null;
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                try {
                    validity = {
                        valid: el.checkValidity(),
                        validationMessage: el.validationMessage || null,
                    };
                } catch {
                    validity = null;
                }
            }
            return {
                tagName: tag,
                type: html_el.getAttribute('type'),
                name: html_el.getAttribute('name'),
                role: html_el.getAttribute('role'),
                id: html_el.id || null,
                accessibleName: html_el.getAttribute('aria-label'),
                visibleLabel: label_el?.textContent?.trim().slice(0, 200) || null,
                required: html_el.hasAttribute('required'),
                disabled: (html_el as HTMLInputElement).disabled === true,
                readOnly: (html_el as HTMLInputElement).readOnly === true,
                autocomplete: html_el.getAttribute('autocomplete'),
                ariaDescribedby: html_el.getAttribute('aria-describedby'),
                ariaInvalid: html_el.getAttribute('aria-invalid'),
                inputMode: html_el.getAttribute('inputmode'),
                pattern: html_el.getAttribute('pattern'),
                formAction: form_action,
                validity,
            };
        });
    });

    const records = forms.map((f) => {
        const form_text = `${f.formAction || ''} ${f.name || ''} ${f.type || ''}`.toLowerCase();
        const inventory_only = RISKY_FORM_KEYWORDS.some((k) => form_text.includes(k));
        return {
            elementIdentity: build_element_identity_from_eval({ id: f.id, tagName: f.tagName }),
            ...f,
            inventoryOnly: inventory_only,
            submitted: false,
        };
    });

    return {
        module: 'forms',
        version: 1,
        phase: 2,
        status: 'success',
        durationMs: Date.now() - started,
        recordCount: records.length,
        truncated: false,
        skipReason: null,
        warnings: [],
        data: { controls: records },
    };
}
