import {
    normalize_rulefile_appendix1,
    read_rulefile_appendix1_summary_text,
    resolve_appendix1_summary_text,
    with_initialized_appendix1_summary_metadata,
} from '../../js/logic/appendix1_summary_text.ts';

describe('appendix1_summary_text', () => {
    test('read_rulefile_appendix1_summary_text läser appendix1.summaryText', () => {
        expect(
            read_rulefile_appendix1_summary_text({
                appendix1: { summaryText: 'Hej **världen**' },
            })
        ).toBe('Hej **världen**');
    });

    test('resolve_appendix1_summary_text prioriterar granskningstext', () => {
        const audit = {
            ruleFileContent: { appendix1: { summaryText: 'Regelfil' } },
            auditMetadata: { appendix1SummaryText: 'Granskning' },
        };
        expect(resolve_appendix1_summary_text(audit)).toBe('Granskning');
    });

    test('resolve_appendix1_summary_text faller tillbaka till regelfil', () => {
        const audit = {
            ruleFileContent: { appendix1: { summaryText: 'Regelfil' } },
            auditMetadata: { caseNumber: '123' },
        };
        expect(resolve_appendix1_summary_text(audit)).toBe('Regelfil');
    });

    test('with_initialized_appendix1_summary_metadata kopierar default', () => {
        const next = with_initialized_appendix1_summary_metadata({
            ruleFileContent: { appendix1: { summaryText: 'Standard' } },
            auditMetadata: { caseNumber: '1' },
        });
        expect(next.auditMetadata?.appendix1SummaryText).toBe('Standard');
    });

    test('normalize_rulefile_appendix1 säkerställer appendix1-objekt', () => {
        const normalized = normalize_rulefile_appendix1({ metadata: { title: 'T' } });
        expect(normalized.appendix1).toEqual({ summaryText: '' });
    });
});
