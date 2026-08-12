/**
 * @fileoverview Orkestrering av snapshot-analysmoduler.
 */
import type { CDPSession, Page } from 'puppeteer';
import type { SnapshotWarning } from '../page_snapshot_cdp.js';
import {
    get_snapshot_analysis_phase1_enabled,
    get_snapshot_analysis_phase2_enabled,
    get_snapshot_analysis_max_ms,
    get_snapshot_analysis_screenshot_max,
    get_analysis_limits_record,
    get_default_analysis_capabilities,
} from './snapshot_analysis_config.js';
import { get_baseline_viewport } from './snapshot_viewport_baseline.js';
import {
    write_analysis_index,
    write_analysis_module_result,
    write_dom_snapshot_schema,
} from './snapshot_analysis_io.js';
import type {
    AnalysisContext,
    AnalysisIndex,
    AnalysisIndexModuleEntry,
    AnalysisModuleDef,
    AnalysisModuleEnvelope,
    AnalysisRunSummary,
    AnalysisSharedState,
} from './snapshot_analysis_types.js';
import { run_keyboard_analysis } from './phase1/keyboard_analysis.js';
import { run_focus_visibility_analysis } from './phase1/focus_visibility_analysis.js';
import { run_reflow_analysis } from './phase1/reflow_analysis.js';
import { run_text_spacing_analysis } from './phase1/text_spacing_analysis.js';
import { run_contrast_analysis } from './phase1/contrast_analysis.js';
import { run_target_size_analysis } from './phase1/target_size_analysis.js';
import { run_safe_interaction_analysis } from './phase1/safe_interaction_analysis.js';
import { run_recurring_components_analysis } from './phase1/recurring_components_analysis.js';
import { run_live_region_analysis } from './phase2/live_region_analysis.js';
import { run_stateful_component_analysis } from './phase2/stateful_component_analysis.js';
import { run_form_analysis } from './phase2/form_analysis.js';
import { run_hover_analysis } from './phase2/hover_analysis.js';
import { run_dynamic_content_analysis } from './phase2/dynamic_content_analysis.js';
import { run_reduced_motion_analysis } from './phase2/reduced_motion_analysis.js';
import { run_pointer_analysis } from './phase2/pointer_analysis.js';
import { run_iframe_analysis } from './phase2/iframe_analysis.js';
import { run_text_resize_analysis } from './phase2/text_resize_analysis.js';
import { run_menu_interaction_analysis } from './phase2/menu_interaction_analysis.js';
import { DOM_SNAPSHOT_COMPUTED_STYLES } from '../page_snapshot_cdp.js';
import { run_analysis_module } from './snapshot_analysis_module_runner.js';

const PHASE1_MODULES: AnalysisModuleDef[] = [
    { name: 'keyboard', phase: 1, version: 1, output_path: 'analysis/phase1/keyboard.json', run: run_keyboard_analysis },
    { name: 'focus-visibility', phase: 1, version: 1, output_path: 'analysis/phase1/focus-visibility.json', run: run_focus_visibility_analysis },
    { name: 'reflow-320', phase: 1, version: 1, output_path: 'analysis/phase1/reflow-320.json', run: run_reflow_analysis },
    { name: 'text-spacing', phase: 1, version: 1, output_path: 'analysis/phase1/text-spacing.json', run: run_text_spacing_analysis },
    { name: 'contrast', phase: 1, version: 1, output_path: 'analysis/phase1/contrast.json', run: run_contrast_analysis },
    { name: 'target-size', phase: 1, version: 1, output_path: 'analysis/phase1/target-size.json', run: run_target_size_analysis },
    { name: 'interactions', phase: 1, version: 1, output_path: 'analysis/phase1/interactions.json', run: run_safe_interaction_analysis },
    { name: 'recurring-components', phase: 1, version: 1, output_path: 'analysis/phase1/recurring-components.json', run: run_recurring_components_analysis },
];

const PHASE2_MODULES: AnalysisModuleDef[] = [
    { name: 'main-menu-states', phase: 2, version: 1, output_path: 'analysis/phase2/main-menu-states.json', run: run_menu_interaction_analysis },
    { name: 'live-regions', phase: 2, version: 1, output_path: 'analysis/phase2/live-regions.json', run: run_live_region_analysis },
    { name: 'stateful-components', phase: 2, version: 1, output_path: 'analysis/phase2/stateful-components.json', run: run_stateful_component_analysis },
    { name: 'forms', phase: 2, version: 1, output_path: 'analysis/phase2/forms.json', run: run_form_analysis },
    { name: 'hover', phase: 2, version: 1, output_path: 'analysis/phase2/hover.json', run: run_hover_analysis },
    { name: 'dynamics', phase: 2, version: 1, output_path: 'analysis/phase2/dynamics.json', run: run_dynamic_content_analysis },
    { name: 'reduced-motion', phase: 2, version: 1, output_path: 'analysis/phase2/reduced-motion.json', run: run_reduced_motion_analysis },
    { name: 'pointer', phase: 2, version: 1, output_path: 'analysis/phase2/pointer.json', run: run_pointer_analysis },
    { name: 'iframes', phase: 2, version: 1, output_path: 'analysis/phase2/iframes.json', run: run_iframe_analysis },
    { name: 'text-resize-200', phase: 2, version: 1, output_path: 'analysis/phase2/text-resize-200.json', run: run_text_resize_analysis },
];

export type RunSnapshotAnalysisInput = {
    page: Page;
    cdp: CDPSession;
    temp_dir: string;
    url: string;
    is_cancelled: () => boolean;
    should_yield_extended: () => boolean;
    yield_on_queue: boolean;
    warnings: SnapshotWarning[];
    initial_consent_envelope?: AnalysisModuleEnvelope | null;
};

function envelope_to_index_entry(
    envelope: AnalysisModuleEnvelope,
    path_rel: string
): AnalysisIndexModuleEntry {
    return {
        module: envelope.module,
        phase: envelope.phase,
        version: envelope.version,
        status: envelope.status,
        durationMs: envelope.durationMs,
        recordCount: envelope.recordCount,
        truncated: envelope.truncated,
        path: path_rel,
        skipReason: envelope.skipReason,
        warnings: envelope.warnings,
    };
}

export async function run_snapshot_analysis(
    input: RunSnapshotAnalysisInput
): Promise<AnalysisRunSummary> {
    const phase1_enabled = get_snapshot_analysis_phase1_enabled();
    const phase2_enabled = get_snapshot_analysis_phase2_enabled();
    const analysis_started = Date.now();
    const analysis_max_ms = get_snapshot_analysis_max_ms();
    let page_corrupted = false;
    const shared: AnalysisSharedState = {};
    const screenshot_budget = { remaining: get_snapshot_analysis_screenshot_max() };
    const module_entries: AnalysisIndexModuleEntry[] = [];

    const should_stop = (): boolean => {
        if (input.is_cancelled()) return true;
        return Date.now() - analysis_started > analysis_max_ms;
    };

    const should_skip_phase2 = (): boolean => {
        if (!phase2_enabled) return true;
        if (input.is_cancelled()) return true;
        if (input.yield_on_queue && input.should_yield_extended()) return true;
        if (Date.now() - analysis_started > analysis_max_ms * 0.85) return true;
        return false;
    };

    const ctx: AnalysisContext = {
        page: input.page,
        cdp: input.cdp,
        temp_dir: input.temp_dir,
        url: input.url,
        should_stop,
        should_skip_phase2,
        page_state_corrupted: () => page_corrupted,
        mark_page_state_corrupted: () => {
            page_corrupted = true;
        },
        warnings: input.warnings,
        shared,
        screenshot_budget,
    };

    await write_dom_snapshot_schema(input.temp_dir, [...DOM_SNAPSHOT_COMPUTED_STYLES]);

    if (input.initial_consent_envelope) {
        await write_analysis_module_result(
            input.temp_dir,
            'analysis/phase1/initial-consent.json',
            input.initial_consent_envelope
        );
        module_entries.push(
            envelope_to_index_entry(
                input.initial_consent_envelope,
                'analysis/phase1/initial-consent.json'
            )
        );
    }

    let phase1_completed = false;
    let phase2_completed = false;

    if (phase1_enabled) {
        for (const def of PHASE1_MODULES) {
            if (should_stop()) {
                const skipped: AnalysisModuleEnvelope = {
                    module: def.name,
                    version: def.version,
                    phase: 1,
                    status: 'skipped',
                    durationMs: 0,
                    recordCount: 0,
                    truncated: false,
                    skipReason: 'analysis-budget-exhausted',
                    warnings: [],
                    data: null,
                };
                await write_analysis_module_result(input.temp_dir, def.output_path, skipped);
                module_entries.push(envelope_to_index_entry(skipped, def.output_path));
                continue;
            }
            const envelope = await run_analysis_module(def, ctx);
            module_entries.push(envelope_to_index_entry(envelope, def.output_path));
        }
        phase1_completed = !should_stop();
    }

    if (phase2_enabled && !should_skip_phase2()) {
        for (const def of PHASE2_MODULES) {
            if (should_stop() || should_skip_phase2()) {
                if (input.yield_on_queue && input.should_yield_extended()) {
                    input.warnings.push({
                        code: 'analysis_phase2_skipped_queue_pressure',
                        message: 'Phase 2 analysis skipped due to queue pressure',
                    });
                }
                const skipped: AnalysisModuleEnvelope = {
                    module: def.name,
                    version: def.version,
                    phase: 2,
                    status: 'skipped',
                    durationMs: 0,
                    recordCount: 0,
                    truncated: false,
                    skipReason: 'phase2-skipped',
                    warnings: [],
                    data: null,
                };
                await write_analysis_module_result(input.temp_dir, def.output_path, skipped);
                module_entries.push(envelope_to_index_entry(skipped, def.output_path));
                continue;
            }
            const envelope = await run_analysis_module(def, ctx);
            module_entries.push(envelope_to_index_entry(envelope, def.output_path));
        }
        phase2_completed = !should_stop() && !should_skip_phase2();
    } else if (phase2_enabled) {
        input.warnings.push({
            code: 'analysis_phase2_skipped_queue_pressure',
            message: 'Phase 2 analysis was not started due to queue pressure or budget',
        });
    }

    const index: AnalysisIndex = {
        analysisVersion: 1,
        sourceSession: 'full-report',
        phase1Enabled: phase1_enabled,
        phase2Enabled: phase2_enabled,
        startedAt: new Date(analysis_started).toISOString(),
        completedAt: new Date().toISOString(),
        baselineViewport: get_baseline_viewport(),
        limits: get_analysis_limits_record(),
        domSnapshotComputedStyles: [...DOM_SNAPSHOT_COMPUTED_STYLES],
        analysisCapabilities: get_default_analysis_capabilities(),
        modules: module_entries,
    };

    await write_analysis_index(input.temp_dir, index);

    return {
        index,
        phase1_completed,
        phase2_completed,
        module_count: module_entries.length,
        warning_count: input.warnings.length,
    };
}
