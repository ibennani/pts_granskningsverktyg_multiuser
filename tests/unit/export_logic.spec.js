import { jest } from '@jest/globals';

// Mock docx library before importing export_logic
const mockParagraph = jest.fn();
const mockTextRun = jest.fn();
const mockDocument = jest.fn();
const mockPacker = {
    toBlob: jest.fn().mockResolvedValue(new Blob())
};

jest.unstable_mockModule('docx', () => ({
    Document: mockDocument,
    Packer: mockPacker,
    Paragraph: mockParagraph,
    TextRun: mockTextRun,
    HeadingLevel: {},
    AlignmentType: {},
    Table: jest.fn(),
    TableRow: jest.fn(),
    TableCell: jest.fn(),
    WidthType: {},
    BorderStyle: {},
    UnderlineType: {},
    ExternalHyperlink: jest.fn(),
    InternalHyperlink: jest.fn(),
    ShadingType: {},
    TabStopType: {},
    SectionType: {},
    PageOrientation: {}
}));

// Mock window globals
global.window = {
    Translation: {
        t: (key) => key,
        get_current_language_code: () => 'sv-SE'
    },
    NotificationComponent: {
        show_global_message: jest.fn()
    },
    Helpers: {
        format_iso_to_local_datetime: jest.fn((date) => date)
    }
};

// Mock URL globally (not on window)
global.URL = {
    createObjectURL: jest.fn(() => 'blob:mock-url'),
    revokeObjectURL: jest.fn()
};

global.document = {
    createElement: jest.fn(() => ({
        setAttribute: jest.fn(),
        click: jest.fn()
    })),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
    }
};

// Mock Paragraph and TextRun constructors to track instances
const paragraphInstances = [];
const textRunInstances = [];

mockParagraph.mockImplementation((config) => {
    const instance = { ...config, type: 'Paragraph' };
    paragraphInstances.push(instance);
    return instance;
});

mockTextRun.mockImplementation((config) => {
    const instance = { ...config, type: 'TextRun' };
    textRunInstances.push(instance);
    return instance;
});

mockDocument.mockImplementation((config) => {
    return {
        sections: config.sections,
        styles: config.styles
    };
});

describe('ExportLogic - Word Export', () => {
    let ExportLogic;

    beforeEach(async () => {
        // Clear all mocks and instances
        jest.clearAllMocks();
        paragraphInstances.length = 0;
        textRunInstances.length = 0;

        // Import after mocks are set up
        const module = await import('../../js/export_logic.js');
        ExportLogic = window.ExportLogic;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Helper function to create mock audit data
    function createMockAudit() {
        return {
            auditStatus: 'locked',
            auditMetadata: {
                caseNumber: 'TEST-001',
                actorName: 'Test Actor',
                actorLink: 'https://example.com',
                auditorName: 'Test Auditor',
                caseHandler: 'Test Handler'
            },
            startTime: '2024-01-01T10:00:00Z',
            endTime: '2024-01-01T12:00:00Z',
            ruleFileContent: {
                metadata: {
                    title: 'Test Rule File',
                    version: '1.0',
                    taxonomies: [{
                        id: 'wcag22-pour',
                        concepts: [
                            { id: 'perceivable', label: 'Perceivable' },
                            { id: 'operable', label: 'Operable' }
                        ]
                    }]
                },
                requirements: {
                    'req1': {
                        id: 'req1',
                        key: 'req1',
                        title: 'Test Requirement 1',
                        standardReference: {
                            text: '1.1.1',
                            url: 'https://example.com/1.1.1'
                        },
                        classifications: [{
                            taxonomyId: 'wcag22-pour',
                            conceptId: 'perceivable'
                        }],
                        checks: [{
                            id: 'check1',
                            passCriteria: [{
                                id: 'pc1',
                                requirement: 'Test pass criterion'
                            }]
                        }]
                    }
                }
            },
            samples: [{
                description: 'Test Sample',
                url: 'https://example.com/test',
                requirementResults: {
                    'req1': {
                        checkResults: {
                            'check1': {
                                overallStatus: 'failed',
                                passCriteria: {
                                    'pc1': {
                                        status: 'failed',
                                        deficiencyId: 'B1',
                                        observationDetail: 'Test observation',
                                        isStandardText: false
                                    }
                                }
                            }
                        }
                    }
                }
            }]
        };
    }

    describe('export_to_word_criterias', () => {
        test('should generate Word document without "Kravets syfte" section', async () => {
            const mockAudit = createMockAudit();

            await ExportLogic.export_to_word_criterias(mockAudit);

            // Verify Document was created
            expect(mockDocument).toHaveBeenCalled();

            // Get all text content from TextRun instances
            const allText = textRunInstances
                .map(tr => tr.text)
                .join(' ');

            // Verify "Kravets syfte" is NOT in the document
            expect(allText).not.toContain('Kravets syfte');
            expect(allText).not.toContain('Här kommer en ny text visas. Denna text är ännu inte klar.');

            // Verify important sections ARE present
            expect(allText).toContain('Redovisning av granskningsresultatet');
        });

        test('should include requirement metadata', async () => {
            const mockAudit = createMockAudit();

            await ExportLogic.export_to_word_criterias(mockAudit);

            const allText = textRunInstances
                .map(tr => tr.text)
                .join(' ');

            // Verify metadata is present
            expect(allText).toContain('Referens:');
            expect(allText).toContain('1.1.1');
        });

        test('should include observation section', async () => {
            const mockAudit = createMockAudit();

            await ExportLogic.export_to_word_criterias(mockAudit);

            const allText = textRunInstances
                .map(tr => tr.text)
                .join(' ');

            // Verify observation section is present
            // When sorting by requirements, observations come directly after "Stickprov:" heading
            expect(allText).toContain('Stickprov:');
            expect(allText).toContain('Test observation');
        });

        test('should handle empty audit gracefully', async () => {
            const emptyAudit = {
                auditStatus: 'locked',
                auditMetadata: {},
                ruleFileContent: { metadata: {}, requirements: {} },
                samples: []
            };

            await ExportLogic.export_to_word_criterias(emptyAudit);

            // Should still create document
            expect(mockDocument).toHaveBeenCalled();
        });
    });

    describe('export_to_word_samples', () => {
        test('should generate Word document without "Om detta krav" section', async () => {
            const mockAudit = createMockAudit();

            await ExportLogic.export_to_word_samples(mockAudit);

            // Verify Document was created
            expect(mockDocument).toHaveBeenCalled();

            // Get all text content from TextRun instances
            const allText = textRunInstances
                .map(tr => tr.text)
                .join(' ');

            // Verify "Om detta krav" is NOT in the document
            expect(allText).not.toContain('Om detta krav');
            expect(allText).not.toContain('Här kommer en ny text visas. Denna text är ännu inte klar.');

            // Verify important sections ARE present
            expect(allText).toContain('Redovisning av granskningsresultatet');
        });

        test('should include "Aktuella observationer" section', async () => {
            const mockAudit = createMockAudit();

            await ExportLogic.export_to_word_samples(mockAudit);

            const allText = textRunInstances
                .map(tr => tr.text)
                .join(' ');

            // Verify observation section is present
            expect(allText).toContain('Aktuella observationer');
            expect(allText).toContain('Test observation');
        });

        test('should include requirement metadata', async () => {
            const mockAudit = createMockAudit();

            await ExportLogic.export_to_word_samples(mockAudit);

            const allText = textRunInstances
                .map(tr => tr.text)
                .join(' ');

            // Verify metadata is present
            expect(allText).toContain('Referens:');
            expect(allText).toContain('1.1.1');
        });

        test('should handle empty audit gracefully', async () => {
            const emptyAudit = {
                auditStatus: 'locked',
                auditMetadata: {},
                ruleFileContent: { metadata: {}, requirements: {} },
                samples: []
            };

            await ExportLogic.export_to_word_samples(emptyAudit);

            // Should still create document
            expect(mockDocument).toHaveBeenCalled();
        });
    });
});
