/**
 * @fileoverview Typer för Bilaga 1-sektioner (array-format).
 */

export type Appendix1SectionFormat = 'paragraphs' | 'list';

export type Appendix1SectionDefinition = {
    id: string;
    kind: 'content' | 'deficiency_group';
    headingLevel: 1 | 2;
    title: string;
    content: string;
    format?: Appendix1SectionFormat;
    conceptId?: string;
};

/** Legacy map-format (bakåtkompatibilitet). */
export type Appendix1Section = {
    title: string;
    content: string;
    format?: Appendix1SectionFormat;
};

export type Appendix1SectionKey =
    | 'introduction'
    | 'method'
    | 'method_legal'
    | 'method_scope'
    | 'method_approach'
    | 'results_intro'
    | 'results_perceivable'
    | 'results_operable'
    | 'results_understandable'
    | 'results_robust';

export type Appendix1SectionsMap = Record<Appendix1SectionKey, Appendix1Section>;

export type Appendix1RulefileSlice = {
    appendix1?: {
        summaryText?: unknown;
        coverImage?: unknown;
        groupingTaxonomyId?: unknown;
        sections?: unknown;
    };
};

export type Appendix1AuditSlice = {
    ruleFileContent?: Appendix1RulefileSlice | null;
    auditMetadata?: {
        appendix1SummaryText?: unknown;
        appendix1SectionOverrides?: unknown;
        caseNumber?: unknown;
        actorName?: unknown;
        actorLink?: unknown;
        auditorName?: unknown;
        caseHandler?: unknown;
        startTime?: unknown;
        endTime?: unknown;
        [key: string]: unknown;
    };
    startTime?: unknown;
    endTime?: unknown;
};

export type Appendix1PlaceholderContext = {
    caseNumber: string;
    actorName: string;
    actorLink: string;
    actorLinkDomain: string;
    auditorName: string;
    caseHandler: string;
    startDate: string;
    endDate: string;
    exportDate: string;
};

export type Appendix1TocEntry = {
    section_id: string;
    title: string;
    heading_level: 1 | 2;
};
