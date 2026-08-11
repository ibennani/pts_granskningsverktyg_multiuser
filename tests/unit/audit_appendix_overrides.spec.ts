/**
 * Enhetstester för granskningsspecifika bilagaöverstyrningar.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_appendix1_override_payload,
    merge_appendix1_slice_with_audit_override,
    resolve_appendix2_excel_labels_for_audit,
    read_appendix3_intro_override,
} from '../../js/logic/audit_appendix_overrides.ts';
import { resolve_appendix3_screenshots_template } from '../../js/logic/appendix3_screenshots_template.ts';

describe('audit_appendix_overrides', () => {
    test('merge_appendix1_slice_with_audit_override uppdaterar brödtext', () => {
        const merged = merge_appendix1_slice_with_audit_override(
            { bodyText: 'Regelfil' },
            { bodyText: 'Granskning' }
        );
        expect(merged?.bodyText).toBe('Granskning');
    });

    test('build_appendix1_override_payload utelämnar sections om de inte skickas med', () => {
        const payload = build_appendix1_override_payload(
            'Brödtext',
            { 'wcag22-pour': 'Brödtext' },
            { perceivable: 'Inledning' }
        );
        expect(payload.appendix1Override).toMatchObject({
            bodyText: 'Brödtext',
            bodyTextByTaxonomy: { 'wcag22-pour': 'Brödtext' },
        });
        expect(payload.appendix1Override).not.toHaveProperty('sections');
        expect(payload.appendix1PrincipleIntroOverrides).toEqual({ perceivable: 'Inledning' });
    });

    test('resolve_appendix2_excel_labels_for_audit mergar audit override', () => {
        const audit = {
            ruleFileContent: {
                metadata: { language: 'sv-SE' },
                appendix2: {
                    labelsByLocale: {
                        'sv-SE': {
                            sheetNames: { general_info: 'Allmän info', deficiencies: 'Brister' },
                            generalInfo: [{ key: 'case_number', label: 'Diarienummer' }],
                            deficiencyColumns: [{ key: 'id', label: 'ID' }],
                        },
                    },
                },
            },
            auditMetadata: {
                appendix2LabelsOverride: {
                    sheetNames: { general_info: 'Min allmän info' },
                },
            },
        };
        const resolved = resolve_appendix2_excel_labels_for_audit(audit);
        expect(resolved.sheet_names.general_info).toBe('Min allmän info');
        expect(resolved.sheet_names.deficiencies).toBe('Brister');
    });

    test('resolve_appendix3_screenshots_template använder audit override', () => {
        const audit = {
            ruleFileContent: { appendix3: { introText: 'Regelfil intro' } },
            auditMetadata: { appendix3IntroTextOverride: 'Granskning intro' },
        };
        expect(read_appendix3_intro_override(audit.auditMetadata)).toBe('Granskning intro');
        const resolved = resolve_appendix3_screenshots_template(audit);
        expect(resolved.introText).toContain('Granskning intro');
    });
});
