import {
    normalize_rulefile_appendix1,
    read_rulefile_appendix1_summary_text,
    resolve_appendix1_summary_text,
    with_initialized_appendix1_summary_metadata,
} from '../../js/logic/appendix1_summary_text.ts';
import { get_default_appendix1_sections } from '../../js/logic/appendix1_sections.ts';

describe('appendix1_summary_text', () => {
    test('read_rulefile_appendix1_summary_text läser introduction från sections', () => {
        expect(
            read_rulefile_appendix1_summary_text({
                appendix1: { sections: get_default_appendix1_sections() },
            })
        ).toContain('{{actorName}}');
    });

    test('resolve_appendix1_summary_text prioriterar granskningstext', () => {
        const audit = {
            auditMetadata: { appendix1SummaryText: 'Granskning' },
            ruleFileContent: { appendix1: { sections: get_default_appendix1_sections() } },
        };
        expect(resolve_appendix1_summary_text(audit)).toBe('Granskning');
    });

    test('resolve_appendix1_summary_text faller tillbaka till regelfil', () => {
        const sections = get_default_appendix1_sections();
        sections.introduction.content = 'Regelfil';
        const audit = {
            ruleFileContent: { appendix1: { sections } },
        };
        expect(resolve_appendix1_summary_text(audit)).toBe('Regelfil');
    });

    test('with_initialized_appendix1_summary_metadata kopierar default', () => {
        const next = with_initialized_appendix1_summary_metadata({
            ruleFileContent: { appendix1: { sections: get_default_appendix1_sections() } },
        });
        expect((next.auditMetadata as { appendix1SummaryText?: string }).appendix1SummaryText).toContain(
            '{{actorName}}'
        );
    });

    test('normalize_rulefile_appendix1 säkerställer appendix1-objekt', () => {
        const normalized = normalize_rulefile_appendix1({ metadata: { title: 'T' } });
        expect(normalized.appendix1).toBeTruthy();
        expect((normalized.appendix1 as { sections: unknown }).sections).toBeTruthy();
    });
});
