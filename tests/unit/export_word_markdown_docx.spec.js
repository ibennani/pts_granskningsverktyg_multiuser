import { jest, beforeAll, beforeEach, describe, test, expect } from '@jest/globals';

const mockTextRun = jest.fn((config) => ({ ...config, type: 'TextRun' }));
const mockExternalHyperlink = jest.fn((config) => ({ ...config, type: 'ExternalHyperlink' }));

jest.unstable_mockModule('docx', () => ({
    Paragraph: jest.fn(),
    TextRun: mockTextRun,
    ExternalHyperlink: mockExternalHyperlink,
    ShadingType: { SOLID: 'solid' }
}));

let parse_markdown_to_text_runs;

beforeAll(async () => {
    const module = await import('../../js/export/export_word_markdown_docx.js');
    parse_markdown_to_text_runs = module.parse_markdown_to_text_runs;
});

function collect_run_text(runs) {
    return runs
        .map((run) => {
            if (run.type === 'TextRun') {
                return run.text ?? '';
            }
            if (run.type === 'ExternalHyperlink') {
                return run.children?.[0]?.text ?? '';
            }
            return '';
        })
        .join('');
}

const INLINE_CODE_TAGS =
    '`<b>`, `<i>`, `<u>`, `<font>`, `<center>`, `<big>`, `<small>` eller `<br>`';

const OBSERVATION_FIXTURE =
    'Sidan använder HTML-element som bara styr visuell presentation: ' +
    INLINE_CODE_TAGS +
    '. Modalen innehåller <b>Maximal lagringstid</b> <b>Typ</b> och på ett annat ställe finns koden ' +
    'auth.netonnet.no<br> auth.netonnet.se<br> beta.netonnet.no<br>';

const HOVER_OBSERVATION_FIXTURE =
    'Innehåll som visas vid hovring förblir inte synligt till dess användaren flyttar pekaren,*väljer*att dölja det, eller tills den visade informationen inte längre är relevant.';

describe('parse_markdown_to_text_runs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renderar flera inline-kod i följd utan INLINECODE-fragment', () => {
        const runs = parse_markdown_to_text_runs(
            'Taggar: `<b>`, `<i>`, `<br>` och mer.'
        );
        const text = collect_run_text(runs);

        expect(text).toContain('<b>');
        expect(text).toContain('<i>');
        expect(text).toContain('<br>');
        expect(text).not.toMatch(/INLINECODE/i);
    });

    test('hanterar verklig observationstext med backticks och rå HTML', () => {
        const runs = parse_markdown_to_text_runs(OBSERVATION_FIXTURE);
        const text = collect_run_text(runs);

        expect(text).toContain('<b>');
        expect(text).toContain('<i>');
        expect(text).toContain('<u>');
        expect(text).toContain('<font>');
        expect(text).toContain('<center>');
        expect(text).toContain('<big>');
        expect(text).toContain('<small>');
        expect(text).toContain('<br>');
        expect(text).toContain('<b>Maximal lagringstid</b>');
        expect(text).toContain('auth.netonnet.no<br>');
        expect(text).not.toMatch(/INLINECODE/i);
    });

    test('renderar kursiv markdown utan ITALIC-fragment i hover-observation', () => {
        const runs = parse_markdown_to_text_runs(HOVER_OBSERVATION_FIXTURE);
        const text = collect_run_text(runs);

        expect(text).toContain('väljer');
        expect(text).toContain('att dölja');
        expect(text).not.toMatch(/ITALIC/i);
        expect(runs.some((run) => run.type === 'TextRun' && run.italics === true && run.text === 'väljer')).toBe(true);
    });

    test('renderar underscore-kursiv utan ITALIC-fragment', () => {
        const runs = parse_markdown_to_text_runs('flyttar pekaren,_väljer_att dölja det');
        const text = collect_run_text(runs);

        expect(text).toContain('väljer');
        expect(text).not.toMatch(/ITALIC/i);
    });

    test('stödjer inline-kod tillsammans med kursiv markdown', () => {
        const runs = parse_markdown_to_text_runs('Kod `foo` och _kursiv_ text.');
        const text = collect_run_text(runs);

        expect(text).toContain('foo');
        expect(text).toContain('kursiv');
        expect(text).not.toMatch(/INLINECODE/i);
    });

    test('behåller fetstil och länkar', () => {
        const runs = parse_markdown_to_text_runs('**fet** och [länk](https://example.com).');
        const text = collect_run_text(runs);

        expect(text).toContain('fet');
        expect(text).toContain('länk');
        expect(runs.some((run) => run.type === 'ExternalHyperlink')).toBe(true);
        expect(text).not.toMatch(/INLINECODE/i);
    });

    test('markerar inline-kod med Courier New', () => {
        parse_markdown_to_text_runs('`<tag>`');
        const code_run = mockTextRun.mock.calls.find((call) => call[0]?.text === '<tag>');

        expect(code_run).toBeDefined();
        expect(code_run[0].font).toBe('Courier New');
    });
});
