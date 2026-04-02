import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';
import { AuditInfoComponent } from './AuditInfoComponent.js';
import { ProgressBarComponent } from './ProgressBarComponent.js';
import * as ScoreCalculator from '../logic/ScoreCalculator.js';
import { get_rules } from '../api/client.js';
import { find_newer_rule_for_audit } from '../logic/newer_rule_check.js';
import {
    newer_rule_banner_dismissal_storage_key,
    should_show_newer_rule_banner
} from '../logic/audit_overview_newer_rule_banner_dismissal.js';
import { version_greater_than } from '../utils/version_utils.js';
import "./audit_overview_component.css";

export class AuditOverviewComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.dispatch = null;
        this.StoreActionTypes = null;
        this.subscribe = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.ExportLogic = null;
        this.AuditLogic = null;
        this.unsubscribe_from_store_function = null;
        this.audit_info_container_element = null;
        this.scoreAnalysisContainerElement = null;
        this.previously_focused_element = null;
        this._last_audit_metadata_snapshot = null;
        this.newerRuleAvailable = null;
        this._newerRuleCheckRequested = false;
        this._auditInfoComponent = null;
        this.handle_store_update = this.handle_store_update.bind(this);
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.subscribe = deps.subscribe;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.ExportLogic = deps.ExportLogic;
        this.AuditLogic = deps.AuditLogic;

        await this.init_sub_components();

        if (!this.unsubscribe_from_store_function && typeof this.subscribe === 'function') {
            this.unsubscribe_from_store_function = this.subscribe(this.handle_store_update);
        }
    }

    async init_sub_components() {
        this.audit_info_container_element = this.Helpers.create_element('div', { id: 'audit-info-component-container', class_name: 'dashboard-panel' });
        this._auditInfoComponent = new AuditInfoComponent();
        await this._auditInfoComponent.init({
            root: this.audit_info_container_element,
            deps: {
                router: this.router,
                getState: this.getState,
                Translation: this.Translation,
                Helpers: this.Helpers,
                AuditLogic: this.AuditLogic
            }
        });

        this.scoreAnalysisContainerElement = this.Helpers.create_element('div', { id: 'score-analysis-component-container' });
        await ScoreAnalysisComponent.init({
            root: this.scoreAnalysisContainerElement,
            deps: {
                Helpers: this.Helpers,
                Translation: this.Translation,
                getState: this.getState,
                ScoreCalculator
            }
        });
    }

    handle_store_update(new_state, listener_meta) {
        if (listener_meta?.skip_render) return;
        if (!this.root || typeof this.render !== 'function') return;

        const new_meta = new_state?.auditMetadata || {};
        const prev_meta = this._last_audit_metadata_snapshot || {};
        const metadata_changed = JSON.stringify(new_meta) !== JSON.stringify(prev_meta);

        if (metadata_changed) {
            this.render();
        }
    }

    render() {
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const current_global_state = this.getState();

        if (!current_global_state || !current_global_state.ruleFileContent) {
            if (this.root) {
                this.root.innerHTML = '';
                const error_div = this.Helpers.create_element('div', { class_name: 'content-plate' });
                error_div.textContent = t("error_no_active_audit");
                this.root.appendChild(error_div);
            }
            this._last_audit_metadata_snapshot = null;
            return;
        }

        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate audit-overview-plate' });
        this.root.appendChild(plate_element);

        this.NotificationComponent.append_global_message_areas_to(plate_element);
        plate_element.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_overview_title') }));

        if (current_global_state.auditStatus !== 'in_progress') {
            this.newerRuleAvailable = null;
            this._newerRuleCheckRequested = false;
        } else if (!this._newerRuleCheckRequested) {
            this._newerRuleCheckRequested = true;
            get_rules()
                .then((rules) => {
                    const result = find_newer_rule_for_audit(current_global_state.ruleFileContent, rules, version_greater_than, current_global_state.ruleSetId);
                    this.newerRuleAvailable = result;
                    if (this.root && result?.ruleId && result?.version) {
                        this.render();
                    }
                })
                .catch(() => {});
        }

        const newer = this.newerRuleAvailable;
        const dismissal_key = newer_rule_banner_dismissal_storage_key(
            current_global_state.auditId,
            current_global_state.ruleSetId
        );
        const dismissed_version = typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem(dismissal_key)
            : null;
        const show_newer_banner = current_global_state.auditStatus === 'in_progress'
            && newer?.ruleId
            && newer?.version
            && should_show_newer_rule_banner(newer.version, dismissed_version);

        if (show_newer_banner) {
            const banner = this.Helpers.create_element('div', {
                class_name: 'audit-overview__newer-rule-banner',
                attributes: { 'aria-live': 'polite' }
            });
            const row = this.Helpers.create_element('div', { class_name: 'audit-overview__newer-rule-banner__row' });
            const left = this.Helpers.create_element('div', { class_name: 'audit-overview__newer-rule-banner__left' });
            left.appendChild(this.Helpers.create_element('span', {
                class_name: 'audit-overview__newer-rule-banner__lead',
                text_content: t('audit_overview_newer_rule_available') + ' '
            }));
            const actions = this.Helpers.create_element('div', { class_name: 'audit-overview__newer-rule-banner__actions' });
            const update_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default', 'audit-overview__newer-rule-banner__btn'],
                text_content: t('update_rulefile_button_with_version', { version: newer.version }),
                attributes: { type: 'button' }
            });
            update_btn.addEventListener('click', () => {
                this.router('update_rulefile', { ruleId: newer.ruleId, version: newer.version });
            });
            actions.appendChild(update_btn);
            const later_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-secondary', 'audit-overview__newer-rule-banner__btn'],
                text_content: t('audit_overview_newer_rule_update_later'),
                attributes: {
                    type: 'button',
                    'aria-label': t('audit_overview_newer_rule_update_later_aria')
                }
            });
            later_btn.addEventListener('click', () => {
                if (typeof sessionStorage !== 'undefined' && newer?.version) {
                    sessionStorage.setItem(dismissal_key, newer.version);
                }
                this.render();
            });
            actions.appendChild(later_btn);
            left.appendChild(actions);
            row.appendChild(left);
            banner.appendChild(row);
            plate_element.appendChild(banner);
        }

        const dashboard_container = this.Helpers.create_element('div', { class_name: 'overview-dashboard' });

        if (this.audit_info_container_element) {
            dashboard_container.appendChild(this.audit_info_container_element);
            this._auditInfoComponent?.render();
        }

        const score_panel = this.Helpers.create_element('div', { class_name: ['dashboard-panel', 'score-panel'] });
        score_panel.appendChild(this.Helpers.create_element('h2', {
            class_name: 'dashboard-panel__title',
            text_content: t('result_summary_and_deficiency_analysis', { defaultValue: "Result Summary" })
        }));

        const status_counts = this.AuditLogic.calculate_overall_audit_status_counts(current_global_state);
        const progress_data = this.AuditLogic.calculate_overall_audit_progress(current_global_state);
        const lang_code = this.Translation.get_current_language_code();
        const audited = progress_data.audited;
        const total_req = progress_data.total;
        const pct_complete = total_req > 0 ? (audited / total_req) * 100 : 0;
        const formatted_pct = this.Helpers.format_number_locally(pct_complete, lang_code, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });

        const progress_heading_id = 'audit-overview-progress-heading';
        const progress_summary_id = 'audit-overview-progress-summary';
        score_panel.appendChild(this.Helpers.create_element('h3', {
            class_name: 'dashboard-panel__subtitle',
            attributes: { id: progress_heading_id },
            text_content: t('total_audit_progress_header', { defaultValue: "Klart hittills" })
        }));

        const summary_p = this.Helpers.create_element('p', {
            class_name: ['progress-text-wrapper', 'audit-overview-progress-summary'],
            attributes: { id: progress_summary_id }
        });
        summary_p.appendChild(this.Helpers.create_element('strong', {
            text_content: `${t('total_audit_progress_header', { defaultValue: 'Klart hittills' })}: `
        }));
        const summary_value_span = this.Helpers.create_element('span', { class_name: 'value' });
        summary_value_span.textContent = t('audit_overview_progress_core', {
            audited,
            total: total_req,
            pct: formatted_pct,
            defaultValue: '{audited} / {total} kontroller ({pct} %)'
        }).trim();
        summary_p.appendChild(summary_value_span);

        const progress_container = this.Helpers.create_element('div', { class_name: 'info-item--progress-container' });
        progress_container.appendChild(summary_p);

        if (ProgressBarComponent) {
            progress_container.appendChild(ProgressBarComponent.create_audit_status_stack({
                counts: status_counts,
                t,
                create_element: this.Helpers.create_element,
                format_number_locally: this.Helpers.format_number_locally,
                lang_code,
                variant: 'default',
                group_labelledby_id: `${progress_heading_id} ${progress_summary_id}`,
                show_total_line: false,
                overview_distribution_layout: true,
                distribution_heading_id: 'audit-overview-distribution-heading'
            }));
        }
        score_panel.appendChild(progress_container);

        const divider = this.Helpers.create_element('div', {
            style: {
                borderBottom: '1px dashed var(--secondary-color)',
                margin: '1.5rem 0'
            }
        });
        score_panel.appendChild(divider);

        if (this.scoreAnalysisContainerElement) {
            score_panel.appendChild(this.scoreAnalysisContainerElement);
            ScoreAnalysisComponent.render();
        }
        dashboard_container.appendChild(score_panel);

        plate_element.appendChild(dashboard_container);

        this._last_audit_metadata_snapshot = JSON.parse(JSON.stringify(current_global_state.auditMetadata || {}));
    }

    destroy() {
        if (this.unsubscribe_from_store_function) {
            this.unsubscribe_from_store_function();
            this.unsubscribe_from_store_function = null;
        }
        this._auditInfoComponent?.destroy();
        this._auditInfoComponent = null;
        ScoreAnalysisComponent.destroy();

        this.scoreAnalysisContainerElement = null;
        this.audit_info_container_element = null;
        this.previously_focused_element = null;
        this._last_audit_metadata_snapshot = null;

        this.root = null;
        this.deps = null;
    }
}
