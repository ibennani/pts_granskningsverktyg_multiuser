import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';
import { SampleTypeDeficiencyChartComponent } from './SampleTypeDeficiencyChartComponent.js';
import { AuditInfoComponent } from './AuditInfoComponent.js';
import { get_rules } from '../api/client.js';
import { find_newer_rule_for_audit } from '../logic/newer_rule_check.js';
import {
    newer_rule_banner_dismissal_storage_key,
    should_show_newer_rule_banner
} from '../logic/audit_overview_newer_rule_banner_dismissal.js';
import { clear_main_view_content_except_global_notifications } from '../logic/app_dom.js';
import {
    build_critical_notice_banner,
    build_critical_notice_banner_row,
    build_version_reload_banner_row
} from '../utils/critical_notice_banner_ui.js';
import {
    get_version_reload_prompt,
    VERSION_RELOAD_PROMPT_EVENT
} from '../logic/version_reload_prompt_state.js';
import { version_greater_than } from '../utils/version_utils.js';
import {
    create_continue_audit_button_if_visible,
    load_instance_users_for_continue
} from './audit_overview_continue_audit.js';
import { build_audit_overview_score_panel } from './audit_overview_score_panel.js';
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
        this.sampleTypeChartContainerElement = null;
        this._sampleTypeChartComponent = null;
        this.previously_focused_element = null;
        this._last_audit_metadata_snapshot = null;
        this._last_rulefile_version_snapshot = null;
        this._last_audit_id_snapshot = null;
        this._last_rule_set_id_snapshot = null;
        this._last_audit_status_snapshot = null;
        this.newerRuleAvailable = null;
        this._newerRuleCheckRequested = false;
        this._auditInfoComponent = null;
        this._known_users_for_continue = null;
        this._known_users_load_started = false;
        this._last_progress_snapshot = null;
        this._on_version_reload_prompt = () => {
            if (this.root) {
                this.render();
            }
        };
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

        if (typeof document !== 'undefined') {
            document.removeEventListener(VERSION_RELOAD_PROMPT_EVENT, this._on_version_reload_prompt);
            document.addEventListener(VERSION_RELOAD_PROMPT_EVENT, this._on_version_reload_prompt);
        }

        // Den här komponenten är en singleton och kan återanvändas mellan olika granskningar.
        // Se till att "nyare regelfil?"-kontrollen körs igen när översikten öppnas.
        this.newerRuleAvailable = null;
        this._newerRuleCheckRequested = false;
        this._last_audit_metadata_snapshot = null;
        this._last_rulefile_version_snapshot = null;
        this._last_audit_id_snapshot = null;
        this._last_rule_set_id_snapshot = null;
        this._last_audit_status_snapshot = null;
        this._known_users_for_continue = null;
        this._known_users_load_started = false;
        this._last_progress_snapshot = null;
    }

    _ensure_known_users_for_continue() {
        if (this._known_users_load_started) return;
        this._known_users_load_started = true;
        void load_instance_users_for_continue().then((users) => {
            const prev = this._known_users_for_continue;
            this._known_users_for_continue = users;
            if (this.root && JSON.stringify(prev) !== JSON.stringify(users)) {
                this.render();
            }
        });
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
                getState: this.getState
            }
        });

        this.sampleTypeChartContainerElement = this.Helpers.create_element('div', {
            id: 'audit-sampletype-chart-root',
            class_name: 'audit-overview-sampletype-chart-wrap'
        });
        this._sampleTypeChartComponent = new SampleTypeDeficiencyChartComponent();
        await this._sampleTypeChartComponent.init({
            root: this.sampleTypeChartContainerElement,
            deps: {
                Helpers: this.Helpers,
                Translation: this.Translation,
                getState: this.getState
            }
        });
    }

    handle_store_update(new_state, listener_meta) {
        if (listener_meta?.skip_render) return;
        if (!this.root || typeof this.render !== 'function') return;

        const new_meta = new_state?.auditMetadata || {};
        const prev_meta = this._last_audit_metadata_snapshot || {};
        const metadata_changed = JSON.stringify(new_meta) !== JSON.stringify(prev_meta);

        const next_rulefile_version = (new_state?.ruleFileContent?.metadata?.version || '').toString().trim();
        const prev_rulefile_version = (this._last_rulefile_version_snapshot || '').toString().trim();
        const rulefile_version_changed = next_rulefile_version !== prev_rulefile_version;

        const next_audit_id = (new_state?.auditId || '').toString();
        const next_rule_set_id = (new_state?.ruleSetId || '').toString();
        const prev_audit_id = (this._last_audit_id_snapshot || '').toString();
        const prev_rule_set_id = (this._last_rule_set_id_snapshot || '').toString();
        const audit_identity_changed = next_audit_id !== prev_audit_id || next_rule_set_id !== prev_rule_set_id;

        const next_status = new_state?.auditStatus;
        const status_changed = next_status !== this._last_audit_status_snapshot;

        const progress_data = this.AuditLogic.calculate_overall_audit_progress(new_state);
        const progress_snapshot = `${progress_data.audited}/${progress_data.total}`;
        const progress_changed = progress_snapshot !== this._last_progress_snapshot;

        if (rulefile_version_changed) {
            // Efter t.ex. "Uppdatera regelfil" måste vi köra en ny kontroll, annars kan den gamla
            // newerRuleAvailable ligga kvar och fortsätta visa bannern.
            this._newerRuleCheckRequested = false;
            this.newerRuleAvailable = null;
        }

        if (audit_identity_changed) {
            // När man byter till en annan granskning måste vi alltid göra om kontrollen.
            this._newerRuleCheckRequested = false;
            this.newerRuleAvailable = null;
        }

        if (metadata_changed || rulefile_version_changed || audit_identity_changed || status_changed || progress_changed) {
            this.render();
        }
    }

    render() {
        const t = this.Translation.t;
        clear_main_view_content_except_global_notifications(this.root);

        const current_global_state = this.getState();

        if (!current_global_state || !current_global_state.ruleFileContent) {
            if (this.root) {
                this.root.innerHTML = '';
                const error_div = this.Helpers.create_element('div', { class_name: 'content-plate' });
                error_div.textContent = t("error_no_active_audit");
                this.root.appendChild(error_div);
            }
            this._last_audit_metadata_snapshot = null;
            this._last_rulefile_version_snapshot = null;
            this._last_audit_id_snapshot = null;
            this._last_rule_set_id_snapshot = null;
            this._last_audit_status_snapshot = null;
            return;
        }
        this._last_rulefile_version_snapshot = (current_global_state?.ruleFileContent?.metadata?.version || '').toString().trim();
        this._last_audit_id_snapshot = (current_global_state?.auditId || '').toString();
        this._last_rule_set_id_snapshot = (current_global_state?.ruleSetId || '').toString();
        this._last_audit_status_snapshot = current_global_state?.auditStatus ?? null;
        const progress_now = this.AuditLogic.calculate_overall_audit_progress(current_global_state);
        this._last_progress_snapshot = `${progress_now.audited}/${progress_now.total}`;

        this._ensure_known_users_for_continue();

        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate audit-overview-plate' });
        this.root.appendChild(plate_element);

        const heading_row = this.Helpers.create_element('div', { class_name: 'audit-overview-heading-row' });
        heading_row.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_overview_title') }));
        const continue_btn = create_continue_audit_button_if_visible({
            Helpers: this.Helpers,
            t,
            getState: this.getState,
            known_users: this._known_users_for_continue,
            router: this.router
        });
        if (continue_btn) {
            heading_row.appendChild(continue_btn);
        }
        plate_element.appendChild(heading_row);

        if (current_global_state.auditStatus !== 'in_progress') {
        this.newerRuleAvailable = null;
        this._newerRuleCheckRequested = false;
        this._on_version_reload_prompt = () => {
            if (this.root) {
                this.render();
            }
        };
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

        if (show_newer_banner || get_version_reload_prompt()) {
            const banner_rows = [];

            const version_prompt = get_version_reload_prompt();
            if (version_prompt) {
                banner_rows.push(build_version_reload_banner_row(this.Helpers, {
                    message: version_prompt.message,
                    reload_label: t('reload_page'),
                    on_reload: () => {
                        void version_prompt.on_reload();
                    }
                }));
            }

            if (show_newer_banner) {
                banner_rows.push(build_critical_notice_banner_row(this.Helpers, {
                    lead_text: t('audit_overview_newer_rule_available') + ' ',
                    buttons: [
                        {
                            text: t('update_rulefile_button_with_version', { version: newer.version }),
                            class_names: ['button', 'button-default', 'audit-overview__newer-rule-banner__btn'],
                            on_click: () => {
                                this.router('update_rulefile', { ruleId: newer.ruleId, version: newer.version });
                            }
                        },
                        {
                            text: t('audit_overview_newer_rule_update_later'),
                            class_names: ['button', 'button-secondary', 'audit-overview__newer-rule-banner__btn'],
                            aria_label: t('audit_overview_newer_rule_update_later_aria'),
                            on_click: () => {
                                if (typeof sessionStorage !== 'undefined' && newer?.version) {
                                    sessionStorage.setItem(dismissal_key, newer.version);
                                }
                                this.render();
                            }
                        }
                    ]
                }));
            }

            plate_element.appendChild(build_critical_notice_banner(this.Helpers, banner_rows));
        }

        const dashboard_container = this.Helpers.create_element('div', { class_name: 'overview-dashboard' });

        if (this.audit_info_container_element) {
            dashboard_container.appendChild(this.audit_info_container_element);
            this._auditInfoComponent?.render();
        }

        const score_panel = build_audit_overview_score_panel({
            Helpers: this.Helpers,
            Translation: this.Translation,
            AuditLogic: this.AuditLogic,
            getState: this.getState,
            scoreAnalysisContainerElement: this.scoreAnalysisContainerElement,
            sampleTypeChartContainerElement: this.sampleTypeChartContainerElement,
            sampleTypeChartComponent: this._sampleTypeChartComponent
        });
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
        if (typeof document !== 'undefined') {
            document.removeEventListener(VERSION_RELOAD_PROMPT_EVENT, this._on_version_reload_prompt);
        }
        ScoreAnalysisComponent.destroy();

        this._sampleTypeChartComponent?.destroy();
        this._sampleTypeChartComponent = null;
        this.sampleTypeChartContainerElement = null;

        this.scoreAnalysisContainerElement = null;
        this.audit_info_container_element = null;
        this.previously_focused_element = null;
        this._last_audit_metadata_snapshot = null;

        this.root = null;
        this.deps = null;
    }
}
