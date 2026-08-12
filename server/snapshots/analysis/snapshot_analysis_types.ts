/**
 * @fileoverview Typer för snapshot-analys (fas 1 och 2).
 */
import type { Page, CDPSession } from 'puppeteer';
import type { SnapshotWarning } from '../page_snapshot_cdp.js';

export type AnalysisModuleStatus = 'success' | 'skipped' | 'partial' | 'failed';

export type AnalysisPhase = 1 | 2;

export type AnalysisModuleEnvelope<T = unknown> = {
    module: string;
    version: number;
    phase: AnalysisPhase;
    status: AnalysisModuleStatus;
    durationMs: number;
    recordCount: number;
    truncated: boolean;
    skipReason: string | null;
    warnings: string[];
    data: T;
};

export type AnalysisIndexModuleEntry = {
    module: string;
    phase: AnalysisPhase;
    version: number;
    status: AnalysisModuleStatus;
    durationMs: number;
    recordCount: number;
    truncated: boolean;
    path: string;
    skipReason: string | null;
    warnings: string[];
};

export type AnalysisCapability = {
    id: string;
    implemented: boolean;
    note?: string;
};

export type AnalysisIndex = {
    analysisVersion: number;
    sourceSession: 'full-report';
    phase1Enabled: boolean;
    phase2Enabled: boolean;
    startedAt: string;
    completedAt: string;
    baselineViewport: {
        width: number;
        height: number;
        deviceScaleFactor: number;
    };
    limits: Record<string, number | boolean>;
    domSnapshotComputedStyles?: string[];
    analysisCapabilities: AnalysisCapability[];
    modules: AnalysisIndexModuleEntry[];
};

export type ElementIdentity = {
    backendNodeId?: number | null;
    id?: string | null;
    selector?: string | null;
    tagName?: string | null;
    domPath?: string | null;
};

export type BoundingBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type SafeInteractionVerdict = {
    safe: boolean;
    reason: string;
};

export type AnalysisContext = {
    page: Page;
    cdp: CDPSession;
    temp_dir: string;
    url: string;
    should_stop: () => boolean;
    should_skip_phase2: () => boolean;
    page_state_corrupted: () => boolean;
    mark_page_state_corrupted: () => void;
    warnings: SnapshotWarning[];
    shared: AnalysisSharedState;
    screenshot_budget: { remaining: number };
};

export type AnalysisSharedState = {
    keyboard_steps?: unknown[];
    safe_interaction_candidates?: unknown[];
    initial_consent_data?: unknown;
};

export type AnalysisModuleDef = {
    name: string;
    phase: AnalysisPhase;
    version: number;
    output_path: string;
    run: (ctx: AnalysisContext) => Promise<AnalysisModuleEnvelope>;
};

export type AnalysisRunSummary = {
    index: AnalysisIndex;
    phase1_completed: boolean;
    phase2_completed: boolean;
    module_count: number;
    warning_count: number;
};
