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
const { build_observation_texts_word_children } = await import(
    '../../js/export/export_observation_texts_word.js'
);

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
    const t = (key, opts = {}) => {
        if (key === 'pass_criterion_deficiency_id_label') {
            return `Brist-id: ${opts.id}`;
        }
        return key;
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('skapar id-paragraf och tabell med röd ram per brist', () => {
        build_observation_texts_word_children([
            { deficiencyId: 'B3', observationDetail: 'Observation A' },
            { deficiencyId: 'B7', observationDetail: 'Observation B' },
        ], t);

        expect(mockParagraph).toHaveBeenCalled();
        expect(mockTable).toHaveBeenCalledTimes(2);

        const id_paragraph = mockParagraph.mock.calls.find(
            ([opts]) => opts?.children?.[0]?.text === 'Brist-id: 3'
        );
        expect(id_paragraph).toBeTruthy();

        const table_call = mockTable.mock.calls[0][0];
        const cell = table_call.rows[0].opts.children[0].opts;
        expect(cell.borders.top.color).toBe('CC0000');
        expect(cell.borders.bottom.color).toBe('CC0000');
    });
});
