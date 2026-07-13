/**
 * @fileoverview Progress- och bristindexpanel för granskningsöversikten.
 */

import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';
import { ProgressBarComponent } from './ProgressBarComponent.js';

type ScorePanelDeps = {
    Helpers: {
        create_element: (
            tag: string,
            options?: Record<string, unknown>
        ) => HTMLElement;
        format_number_locally: (
            value: number,
            lang_code: string,
            options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
        ) => string;
    };
    Translation: {
        t: (key: string, opts?: Record<string, unknown>) => string;
        get_current_language_code: () => string;
    };
    AuditLogic: {
        calculate_overall_audit_status_counts: (state: Record<string, unknown>) => Record<string, number>;
        calculate_overall_audit_progress: (state: Record<string, unknown>) => { audited: number; total: number };
    };
    getState: () => Record<string, unknown>;
    scoreAnalysisContainerElement: HTMLElement | null;
    sampleTypeChartContainerElement: HTMLElement | null;
    sampleTypeChartComponent: { render: () => void } | null;
};

/** Bygger score-panelen med progress, bristindex och diagram. */
export function build_audit_overview_score_panel(deps: ScorePanelDeps): HTMLElement {
    const { Helpers, Translation, AuditLogic, getState } = deps;
    const t = Translation.t;
    const current_global_state = getState();

    const score_panel = Helpers.create_element('div', {
        class_name: ['dashboard-panel', 'score-panel']
    });
    score_panel.appendChild(
        Helpers.create_element('h2', {
            class_name: 'dashboard-panel__title',
            text_content: t('result_summary_and_deficiency_analysis', { defaultValue: 'Result Summary' })
        })
    );

    const status_counts = AuditLogic.calculate_overall_audit_status_counts(current_global_state);
    const progress_data = AuditLogic.calculate_overall_audit_progress(current_global_state);
    const lang_code = Translation.get_current_language_code();
    const audited = progress_data.audited;
    const total_req = progress_data.total;
    const pct_complete = total_req > 0 ? (audited / total_req) * 100 : 0;
    const formatted_pct = Helpers.format_number_locally(pct_complete, lang_code, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

    const progress_heading_id = 'audit-overview-progress-heading';
    const progress_summary_id = 'audit-overview-progress-summary';
    score_panel.appendChild(
        Helpers.create_element('h3', {
            class_name: 'dashboard-panel__subtitle',
            attributes: { id: progress_heading_id },
            text_content: t('total_audit_progress_header', { defaultValue: 'Klart hittills' })
        })
    );

    const summary_p = Helpers.create_element('p', {
        class_name: ['progress-text-wrapper', 'audit-overview-progress-summary'],
        attributes: { id: progress_summary_id }
    });
    summary_p.appendChild(
        Helpers.create_element('strong', {
            text_content: `${t('total_audit_progress_header', { defaultValue: 'Klart hittills' })}: `
        })
    );
    const summary_value_span = Helpers.create_element('span', { class_name: 'value' });
    summary_value_span.textContent = t('audit_overview_progress_core', {
        audited,
        total: total_req,
        pct: formatted_pct,
        defaultValue: '{audited} / {total} kontroller ({pct} %)'
    }).trim();
    summary_p.appendChild(summary_value_span);

    const progress_container = Helpers.create_element('div', { class_name: 'info-item--progress-container' });
    progress_container.appendChild(summary_p);

    if (ProgressBarComponent) {
        progress_container.appendChild(
            ProgressBarComponent.create_audit_status_stack({
                counts: status_counts,
                t,
                create_element: Helpers.create_element,
                format_number_locally: Helpers.format_number_locally,
                lang_code,
                variant: 'default',
                group_labelledby_id: `${progress_heading_id} ${progress_summary_id}`,
                show_total_line: false,
                overview_distribution_layout: true,
                distribution_heading_id: 'audit-overview-distribution-heading'
            })
        );
    }
    score_panel.appendChild(progress_container);

    score_panel.appendChild(
        Helpers.create_element('div', {
            style: {
                borderBottom: '1px dashed var(--secondary-color)',
                margin: '1.5rem 0'
            }
        })
    );

    if (deps.scoreAnalysisContainerElement) {
        score_panel.appendChild(deps.scoreAnalysisContainerElement);
        ScoreAnalysisComponent.render();
    }

    if (deps.sampleTypeChartContainerElement && deps.sampleTypeChartComponent) {
        score_panel.appendChild(deps.sampleTypeChartContainerElement);
        deps.sampleTypeChartComponent.render();
    }

    return score_panel;
}
