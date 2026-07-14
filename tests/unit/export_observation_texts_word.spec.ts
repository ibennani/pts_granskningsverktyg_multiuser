/**
 * Tester för Word-export av observationstexter till handläggare.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockParagraph = jest.fn(function MockParagraph(opts) {
    this.opts = opts;
    return this;
});
const mockTextRun = jest.fn(function MockTextRun(opts) {
    this.text = opts?.text;
    this.bold = opts?.bold;
    return this;
});
const mockTable = jest.fn(function MockTable(opts) {
    this.opts = opts;
    return this;
});
const mockTableRow = jest.fn(function MockTableRow(opts) {
    this.opts = opts;
    return this;
});
const mockTableCell = jest.fn(function MockTableCell(opts) {
    this.opts = opts;
    return this;
});

jest.unstable_mockModule('docx', () => ({
    BorderStyle: { SINGLE: 'single' },
    Paragraph: mockParagraph,
    Table: mockTable,
    TableCell: mockTableCell,
    TableRow: mockTableRow,
    TextRun: mockTextRun,
    TabStopType: { LEFT: 'left' },
    WidthType: { PERCENTAGE: 'pct' },
}));

jest.unstable_mockModule('../../js/export/export_word_markdown_docx.js', () => ({
    parse_markdown_to_text_runs: (text) => [new mockTextRun({ text })],
}));

jest.unstable_mockModule('../../js/export/export_word_main_flow_document.js', () => ({
    finalize_word_export_download: jest.fn(),
}));

jest.unstable_mockModule('../../js/export/export_error_handling.js', () => ({
    finalize_export_catch: jest.fn(),
}));

jest.unstable_mockModule('../../js/export/export_report_filename.js', () => ({
    build_observation_texts_word_filename: jest.fn(() => 'test_observationstexter.docx'),
}));

const { collect_observation_export_deficiencies } = await import(
    '../../js/export/export_observation_texts_collect.js'
);
const {
    build_observation_texts_word_children,
    build_bold_placeholder_intro_runs,
    create_observation_texts_export_t,
} = await import('../../js/export/export_observation_texts_word.js');

const RULEFILE_SV = { metadata: { language: 'sv-SE' } };
const RULEFILE_EN = { metadata: { language: 'en-GB' } };

function create_audit_for_word_export(entries, metadata = {}) {
    const audit = create_audit_with_deficiencies(entries);
    audit.auditMetadata = {
        caseNumber: '2024-123',
        actorName: 'Testbolaget AB',
        ...metadata,
    };
    return audit;
}

function create_audit_with_deficiencies(entries) {
    const pass_criteria = {};
    for (const entry of entries) {
        pass_criteria[entry.pc_id] = {
            status: 'failed',
            deficiencyId: entry.deficiency_id,
            observationDetail: entry.observation,
        };
    }

    return {
        ruleFileContent: {
            metadata: { language: 'sv-SE' },
            requirements: {
                req1: {
                    id: 'req1',
                    title: 'Krav 1',
                    checks: [{
                        id: 'check1',
                        passCriteria: entries.map((entry) => ({
                            id: entry.pc_id,
                            requirement: entry.fallback || 'Standardtext',
                            failureStatementTemplate: entry.template || '',
                        })),
                    }],
                },
            },
        },
        samples: [{
            id: 's1',
            requirementResults: {
                req1: {
                    checkResults: {
                        check1: {
                            passCriteria: pass_criteria,
                        },
                    },
                },
            },
        }],
    };
}

describe('collect_observation_export_deficiencies', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('sorterar brister stigande på brist-id', () => {
        const audit = create_audit_with_deficiencies([
            { pc_id: 'pc2', deficiency_id: 'B10', observation: 'Tio' },
            { pc_id: 'pc1', deficiency_id: 'B2', observation: 'Två' },
        ]);

        const result = collect_observation_export_deficiencies(audit);
        expect(result.map((item) => item.deficiencyId)).toEqual(['B2', 'B10']);
    });

    test('använder standardtext när observation saknas', () => {
        const audit = create_audit_with_deficiencies([
            { pc_id: 'pc1', deficiency_id: 'B1', observation: '', fallback: 'Kravtext här' },
        ]);

        const result = collect_observation_export_deficiencies(audit);
        expect(result).toHaveLength(1);
        expect(result[0].observationDetail).toBe('Kravtext här');
    });

    test('deduplicerar samma brist-id', () => {
        const audit = create_audit_with_deficiencies([
            { pc_id: 'pc1', deficiency_id: 'B1', observation: 'Första' },
            { pc_id: 'pc2', deficiency_id: 'B1', observation: 'Andra' },
        ]);

        const result = collect_observation_export_deficiencies(audit);
        expect(result).toHaveLength(1);
    });
});

describe('build_observation_texts_word_children', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('lägger till h1, intro med dnr och aktör, punktlistor och h2 per brist-id', () => {
        const audit = create_audit_for_word_export([
            { pc_id: 'pc1', deficiency_id: 'B3', observation: 'Observation A' },
            { pc_id: 'pc2', deficiency_id: 'B7', observation: 'Observation B' },
        ]);

        build_observation_texts_word_children([
            { deficiencyId: 'B3', observationDetail: 'Observation A' },
            { deficiencyId: 'B7', observationDetail: 'Observation B' },
        ], audit);

        const title_paragraph = mockParagraph.mock.calls.find(
            ([opts]) => opts?.heading === 'Heading1'
                && opts?.children?.[0]?.text === 'Observationstexter för handläggning'
        );
        expect(title_paragraph).toBeTruthy();

        const intro_paragraph = mockParagraph.mock.calls.find(
            ([opts]) => opts?.children?.some((child) => child?.text === '2024-123' && child?.bold === true)
        );
        expect(intro_paragraph).toBeTruthy();
        expect(intro_paragraph[0].children.find((child) => child.text === '2024-123')?.bold).toBe(true);
        expect(intro_paragraph[0].children.find((child) => child.text === '"Testbolaget AB"')?.bold).toBe(true);
        expect(intro_paragraph[0].children.some((child) => child.text === ': ')).toBe(true);

        const edit_bullet = mockParagraph.mock.calls.find(
            ([opts]) => opts?.children?.[1]?.text?.includes('röda ramen')
        );
        expect(edit_bullet).toBeTruthy();
        expect(edit_bullet[0].children[0].text).toBe('•\t');

        const delete_bullet = mockParagraph.mock.calls.find(
            ([opts]) => opts?.children?.[1]?.text?.includes('radera brist-id')
        );
        expect(delete_bullet).toBeTruthy();

        const return_paragraph = mockParagraph.mock.calls.find(
            ([opts]) => opts?.children?.[0]?.text
                === 'Skicka tillbaka dokumentet till granskaren när alla texter är uppdaterade.'
        );
        expect(return_paragraph).toBeTruthy();

        const id_heading = mockParagraph.mock.calls.find(
            ([opts]) => opts?.heading === 'Heading2'
                && opts?.children?.[0]?.text === 'Brist-id: 3'
        );
        expect(id_heading).toBeTruthy();

        expect(mockTable).toHaveBeenCalledTimes(2);

        const table_call = mockTable.mock.calls[0][0];
        const cell = table_call.rows[0].opts.children[0].opts;
        expect(cell.borders.top.color).toBe('CC0000');
        expect(cell.borders.bottom.color).toBe('CC0000');
    });
});

describe('build_bold_placeholder_intro_runs', () => {
    test('sätter fetstil på dnr och aktörsnamn med citationstecken', () => {
        const runs = build_bold_placeholder_intro_runs(
            'Text före {dnr}: {actor_name} efter.',
            { dnr: '2024-1', actor_name: '"Acme AB"' }
        );

        expect(runs).toHaveLength(5);
        expect(runs[1].text).toBe('2024-1');
        expect(runs[1].bold).toBe(true);
        expect(runs[2].text).toBe(': ');
        expect(runs[3].text).toBe('"Acme AB"');
        expect(runs[3].bold).toBe(true);
        expect(runs[0].bold).toBeUndefined();
    });
});

describe('create_observation_texts_export_t', () => {
    test('använder regelfilens språk för exporttexter', () => {
        const t_sv = create_observation_texts_export_t(RULEFILE_SV);
        const t_en = create_observation_texts_export_t(RULEFILE_EN);

        expect(t_sv('export_observation_texts_word_title')).toBe('Observationstexter för handläggning');
        expect(t_en('export_observation_texts_word_title')).toBe('Observation texts for processing');
        expect(t_sv('pass_criterion_deficiency_id_label', { id: '5' })).toBe('Brist-id: 5');
        expect(t_sv('export_observation_texts_word_intro', {
            dnr: '2024-1',
            actor_name: 'Acme',
        })).toContain('2024-1');
        expect(t_sv('export_observation_texts_word_intro', {
            dnr: '2024-1',
            actor_name: 'Acme',
        })).toContain('Acme');
    });
});
