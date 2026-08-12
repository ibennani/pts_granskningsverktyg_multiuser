/**
 * @fileoverview Miljökonfiguration för snapshot-analys.
 */
function read_int_env(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function read_bool_env(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

export function get_snapshot_analysis_phase1_enabled(): boolean {
    return read_bool_env('GV_SNAPSHOT_ANALYSIS_PHASE1_ENABLED', true);
}

export function get_snapshot_analysis_phase2_enabled(): boolean {
    return read_bool_env('GV_SNAPSHOT_ANALYSIS_PHASE2_ENABLED', true);
}

export function get_snapshot_analysis_max_ms(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_MAX_MS', 45_000);
}

export function get_snapshot_analysis_tab_max_steps(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_TAB_MAX_STEPS', 200);
}

export function get_snapshot_analysis_interaction_max(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_INTERACTION_MAX', 30);
}

export function get_snapshot_analysis_hover_max(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_HOVER_MAX', 20);
}

export function get_snapshot_analysis_iframe_max(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_IFRAME_MAX', 5);
}

export function get_snapshot_analysis_mutation_max(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_MUTATION_MAX', 500);
}

export function get_snapshot_analysis_dynamic_ms(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_DYNAMIC_MS', 5000);
}

export function get_snapshot_analysis_dialog_tab_max(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_DIALOG_TAB_MAX', 30);
}

export function get_snapshot_analysis_screenshot_max(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_SCREENSHOT_MAX', 5);
}

export function get_snapshot_analysis_consent_wait_ms(): number {
    return read_int_env('GV_SNAPSHOT_ANALYSIS_CONSENT_WAIT_MS', 3500);
}

export function get_analysis_limits_record(): Record<string, number | boolean> {
    return {
        phase1Enabled: get_snapshot_analysis_phase1_enabled(),
        phase2Enabled: get_snapshot_analysis_phase2_enabled(),
        analysisMaxMs: get_snapshot_analysis_max_ms(),
        tabMaxSteps: get_snapshot_analysis_tab_max_steps(),
        interactionMax: get_snapshot_analysis_interaction_max(),
        hoverMax: get_snapshot_analysis_hover_max(),
        iframeMax: get_snapshot_analysis_iframe_max(),
        mutationMax: get_snapshot_analysis_mutation_max(),
        dynamicMs: get_snapshot_analysis_dynamic_ms(),
        dialogTabMax: get_snapshot_analysis_dialog_tab_max(),
        screenshotMax: get_snapshot_analysis_screenshot_max(),
    };
}

export function get_default_analysis_capabilities(): Array<{
    id: string;
    implemented: boolean;
    note?: string;
}> {
    return [
        { id: 'keyboard-tab-sequence', implemented: true },
        { id: 'focus-visibility-styles', implemented: true },
        { id: 'reflow-320', implemented: true },
        { id: 'text-spacing', implemented: true },
        { id: 'contrast-evidence', implemented: true },
        { id: 'target-size', implemented: true },
        { id: 'safe-interactions', implemented: true },
        { id: 'initial-consent-evidence', implemented: true },
        { id: 'live-regions', implemented: true },
        { id: 'stateful-components', implemented: true },
        { id: 'forms-inventory', implemented: true },
        { id: 'hover-tooltips', implemented: true },
        { id: 'dynamic-content', implemented: true },
        { id: 'reduced-motion', implemented: true },
        { id: 'pointer-events', implemented: true },
        { id: 'iframes', implemented: true },
        { id: 'text-resize-200', implemented: true },
        {
            id: 'three-flashes',
            implemented: false,
            note: 'Manuell granskning krävs. Ingen automatisk blinkningsanalys.',
        },
    ];
}
