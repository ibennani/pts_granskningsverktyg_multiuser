/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { build_audit_content_payload } from '../../server/services/llm_tool_audit_content.ts';
import {
    compact_requirements_from_rule_content,
    resolve_requirement_title
} from '../../server/services/llm_tool_rule_requirements.ts';

describe('llm_tool_rule_requirements', () => {
    test('compact_requirements_from_rule_content läser titlar från objektformat', () => {
        const list = compact_requirements_from_rule_content({
            requirements: {
                req1: { id: 'req1', title: 'Kontrast', reference: '1.4.3' },
                req2: { key: 'req2', title: 'Tangentbord' }
            }
        });
        expect(list).toHaveLength(2);
        expect(list[0]).toEqual({ id: 'req1', title: 'Kontrast', reference: '1.4.3' });
    });

    test('resolve_requirement_title hittar titel via key', () => {
        const title = resolve_requirement_title(
            { requirements: [{ key: 'k1', title: 'Rubriknivåer' }] },
            'k1'
        );
        expect(title).toBe('Rubriknivåer');
    });
});

describe('build_audit_content_payload', () => {
    test('returnerar stickprov med observationer och kravtitlar', () => {
        const payload = build_audit_content_payload(
            {
                id: 'audit-1',
                rule_set_id: 'rule-1',
                rule_set_name: 'WCAG 2.2',
                status: 'in_progress',
                metadata: { title: 'Kommun X' },
                rule_file_content: {
                    requirements: { r1: { id: 'r1', title: 'Kontrast' } }
                },
                samples: [
                    {
                        id: 's1',
                        description: 'Startsida',
                        url: 'https://example.com',
                        requirementResults: {
                            r1: {
                                status: 'failed',
                                observationDetail: 'Låg kontrast i sidfot',
                                commentToActor: 'Åtgärda färger'
                            }
                        }
                    }
                ]
            },
            { status_filter: 'failed' }
        );
        expect(payload.entity_type).toBe('audit');
        expect(payload.title).toBe('Kommun X');
        expect(payload.samples).toHaveLength(1);
        const results = (payload.samples as { requirement_results: { requirement_title: string }[] }[])[0]
            .requirement_results;
        expect(results[0]?.requirement_title).toBe('Kontrast');
        expect(results[0]?.observation).toContain('kontrast');
    });

    test('kastar om stickprov saknas', () => {
        expect(() =>
            build_audit_content_payload(
                { id: 'a', metadata: {}, samples: [], rule_file_content: null },
                { sample_id: 'saknas' }
            )
        ).toThrow(/Stickprovet hittades inte/);
    });
});
