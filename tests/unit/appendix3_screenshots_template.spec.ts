import {
    normalize_rulefile_appendix3,
    read_rulefile_appendix3_template,
    resolve_appendix3_screenshots_template,
} from '../../js/logic/appendix3_screenshots_template.ts';

describe('appendix3_screenshots_template', () => {
    test('normalize_rulefile_appendix3 tar bort anpassad rubrik och fyller intro', () => {
        const normalized = normalize_rulefile_appendix3({
            appendix3: { title: 'Egen rubrik', introText: 'Min intro' },
        });
        const template = read_rulefile_appendix3_template(normalized);
        expect((normalized as { appendix3: { title?: string } }).appendix3.title).toBeUndefined();
        expect(template.title).toBe('Bilaga 3: {{caseNumber}} {{actorName}}');
        expect(template.introText).toBe('Min intro');
    });

    test('resolve_appendix3_screenshots_template använder fast rubrik med platshållare', () => {
        const audit = {
            ruleFileContent: normalize_rulefile_appendix3({
                appendix3: {
                    introText: 'Granskning av {{actorName}}.',
                },
            }),
            auditMetadata: {
                caseNumber: '2026-1',
                actorName: 'Exempel AB',
            },
        };
        const resolved = resolve_appendix3_screenshots_template(audit);
        expect(resolved.title).toBe('Bilaga 3: 2026-1 Exempel AB');
        expect(resolved.introText).toBe('Granskning av Exempel AB.');
    });
});
