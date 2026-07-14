/**
 * @fileoverview Sammanfattande progressmeddelanden för modalen Hämta information.
 */

export type SampleUrlAnalyzeProgressPhase = 'idle' | 'running' | 'done';

export type SampleUrlAnalyzeProgressState = {
    completed: number;
    total: number;
    failed: number;
    phase: SampleUrlAnalyzeProgressPhase;
};

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

export function build_sample_url_analyze_progress_message(
    t: TranslationFn,
    state: SampleUrlAnalyzeProgressState
): string {
    const { completed, total, failed, phase } = state;

    if (phase === 'idle') {
        return '';
    }

    if (phase === 'running') {
        if (completed === 0) {
            return t('sample_url_analyze_progress_started', { total });
        }
        return t('sample_url_analyze_progress_partial', { completed, total });
    }

    if (failed > 0) {
        return t('sample_url_analyze_progress_done_with_errors', { failed, total });
    }

    return t('sample_url_analyze_progress_done');
}

export function build_sample_url_analyze_progress_value_text(
    t: TranslationFn,
    state: SampleUrlAnalyzeProgressState
): string {
    const message = build_sample_url_analyze_progress_message(t, state);
    if (message) {
        return message;
    }
    return t('sample_url_analyze_progress_waiting', { total: state.total });
}
