/**
 * @fileoverview Enhetstester för webb-katalogen med detectionPattern.
 */
import { describe, test, expect } from '@jest/globals';
import {
    WEB_CONTENT_TYPE_DETECTION_PATTERNS_BY_LABEL,
    WEB_TEXT_CONTENT_ALWAYS_TRUE_PATTERN,
    resolve_web_detection_pattern_for_label,
} from '../../shared/rulefile/content_type_detection_pattern_web_catalog.ts';
import {
    compile_content_type_detection_pattern,
    is_valid_content_type_detection_pattern,
} from '../../shared/rulefile/content_type_detection_pattern.ts';
import {
    apply_detection_patterns_to_content_types,
    resolve_rulefile_monitoring_kind,
} from '../../shared/rulefile/content_type_detection_pattern_rulefile_apply.ts';

describe('content_type_detection_pattern_web_catalog', () => {
    test('alla katalogmönster är giltiga RegExp', () => {
        for (const [label, pattern] of Object.entries(WEB_CONTENT_TYPE_DETECTION_PATTERNS_BY_LABEL)) {
            expect(is_valid_content_type_detection_pattern(pattern)).toBe(true);
            expect(compile_content_type_detection_pattern(pattern)).not.toBeNull();
            void label;
        }
    });

    test('Text-mönstret matchar alltid icke-tom HTML', () => {
        expect(WEB_TEXT_CONTENT_ALWAYS_TRUE_PATTERN).toBe(resolve_web_detection_pattern_for_label('Text'));
        const regex = compile_content_type_detection_pattern(WEB_TEXT_CONTENT_ALWAYS_TRUE_PATTERN);
        expect(regex?.test('<p>Hej</p>')).toBe(true);
        expect(regex?.test(' ')).toBe(true);
    });

    test('Rubriker matchar h3 och role=heading', () => {
        const pattern = resolve_web_detection_pattern_for_label('Rubriker');
        const regex = compile_content_type_detection_pattern(pattern || '');
        expect(regex?.test('<h3>Titel</h3>')).toBe(true);
        expect(regex?.test('<div role="heading">Titel</div>')).toBe(true);
    });

    test('CAPTCHA matchar vanliga leverantörer', () => {
        const pattern = resolve_web_detection_pattern_for_label('CAPTCHA');
        const regex = compile_content_type_detection_pattern(pattern || '');
        expect(regex?.test('<div class="g-recaptcha"></div>')).toBe(true);
        expect(regex?.test('https://challenges.cloudflare.com/turnstile/v0/api.js')).toBe(true);
    });
});

describe('content_type_detection_pattern_rulefile_apply', () => {
    test('resolve_rulefile_monitoring_kind skiljer webb och pdf', () => {
        expect(resolve_rulefile_monitoring_kind({ monitoringType: { type: 'web', text: 'Webb' } })).toBe('web');
        expect(resolve_rulefile_monitoring_kind({ monitoringType: { text: 'PDF-dokument' } })).toBe('pdf');
        expect(resolve_rulefile_monitoring_kind({ monitoringType: { text: 'Övrigt' } })).toBe('unknown');
    });

    test('webb-regelfil får katalogmönster på kända undertyper', () => {
        const applied = apply_detection_patterns_to_content_types(
            [
                {
                    id: 'text',
                    text: 'Text',
                    types: [
                        { id: 'text', text: 'Text' },
                        { id: 'rubriker', text: 'Rubriker' },
                        { id: 'ovrigt', text: 'Ospecificerad typ' },
                    ],
                },
            ],
            'web'
        );
        expect(applied[0]?.types?.[0]?.detectionPattern).toBe(WEB_TEXT_CONTENT_ALWAYS_TRUE_PATTERN);
        expect(applied[0]?.types?.[1]?.detectionPattern).toContain('h[1-6]');
        expect(applied[0]?.types?.[2]?.detectionPattern).toBeUndefined();
    });

    test('pdf-regelfil rensar detectionPattern', () => {
        const applied = apply_detection_patterns_to_content_types(
            [
                {
                    id: 'text',
                    text: 'Text',
                    types: [{ id: 'rubriker', text: 'Rubriker', detectionPattern: '<h1>' }],
                },
            ],
            'pdf'
        );
        expect(applied[0]?.types?.[0]?.detectionPattern).toBeUndefined();
    });
});
