/**
 * @fileoverview Gemensamma typer för granskningslogik (stickprov, krav, kontroller, kriterier).
 */

/** Bedömningskriterium i regelfil (kontrollpunkt). */
export type PassCriterionDef = {
    id?: string;
    key?: string;
    requirement?: string;
    failureStatementTemplate?: string;
};

/** Kontrollpunkt i regelfil. */
export type CheckDef = {
    id?: string;
    key?: string;
    logic?: string;
    passCriteria?: PassCriterionDef[];
};

/** Kravdefinition i regelfil. */
export type RequirementDef = {
    key?: string;
    id?: string;
    title?: string;
    checks?: CheckDef[];
    standardReference?: { text?: string; url?: string };
    contentType?: string[];
    metadata?: Record<string, { text?: string } | undefined>;
    classifications?: unknown[];
};

export type PassCriterionStored = Record<string, unknown> & {
    status?: string;
    deficiencyId?: string;
    timestamp?: string;
    attachedMediaFilenames?: unknown;
    observationDetail?: string;
    updatedBy?: string;
};

export type CheckResultStored = Record<string, unknown> & {
    passCriteria?: Record<string, PassCriterionStored>;
    overallStatus?: string;
    status?: string;
    timestamp?: string;
};

export type RequirementResultStored = Record<string, unknown> & {
    checkResults?: Record<string, CheckResultStored>;
    status?: string;
    lastStatusUpdate?: string;
    lastStatusUpdateBy?: string;
    stuckProblemDescription?: string;
    needsReview?: boolean;
    commentToAuditor?: string;
    commentToActor?: string;
};

export type SampleStored = Record<string, unknown> & {
    id?: string;
    description?: string;
    url?: string;
    selectedContentTypes?: string[];
    requirementResults?: Record<string, RequirementResultStored>;
};

export type RuleFileForAudit = Record<string, unknown> & {
    requirements?: Record<string, RequirementDef> | RequirementDef[];
    metadata?: Record<string, unknown>;
};

declare global {
    interface Window {
        ConsoleManager?: { warn?: (...args: unknown[]) => void };
    }
}

export type AuditStateShape = Record<string, unknown> & {
    samples?: SampleStored[];
    ruleFileContent?: RuleFileForAudit;
    auditStatus?: string;
    deficiencyCounter?: number;
    startTime?: string | null;
    endTime?: string | null;
    auditLastNonObservationActivityAt?: string | null;
    auditLastUpdatedAtFrozen?: string | null;
    updated_at?: string | null;
};

export type PassCriterionStatusMapVal = { status?: string } | string | undefined | null;
