import {
    apply_appendix1_placeholders,
    build_appendix1_placeholder_context,
    get_default_appendix1_sections,
    normalize_rulefile_appendix1,
    read_rulefile_appendix1_sections,
    resolve_appendix1_sections,
} from '../../js/logic/appendix1_sections.ts';

describe('appendix1_sections', () => {
    test('read_rulefile_appendix1_sections fyller defaults', () => {
        const sections = read_rulefile_appendix1_sections({ appendix1: {} });
        expect(sections.introduction.title).toBe('1. Inledning');
        expect(sections.introduction.content).toContain('{{actorName}}');
    });

    test('apply_appendix1_placeholders ersätter metadata', () => {
        const context = build_appendix1_placeholder_context({
            auditMetadata: {
                caseNumber: '25-001',
                actorName: 'Test AB',
                actorLink: 'https://www.example.se/',
            },
        });
        const text = apply_appendix1_placeholders('Ärende {{caseNumber}} för {{actorName}}', context);
        expect(text).toBe('Ärende 25-001 för Test AB');
    });

    test('resolve_appendix1_sections prioriterar granskningstext för inledning', () => {
        const audit = {
            auditMetadata: { appendix1SummaryText: 'Granskningsspecifik inledning' },
            ruleFileContent: {
                appendix1: {
                    sections: get_default_appendix1_sections(),
                },
            },
        };
        expect(resolve_appendix1_sections(audit).introduction.content).toBe('Granskningsspecifik inledning');
    });

    test('normalize_rulefile_appendix1 migrerar summaryText till introduction', () => {
        const normalized = normalize_rulefile_appendix1({
            appendix1: { summaryText: 'Gammal sammanfattning' },
        });
        const appendix1 = normalized.appendix1 as { sections: { introduction: { content: string } } };
        expect(appendix1.sections.introduction.content).toBe('Gammal sammanfattning');
    });
});
