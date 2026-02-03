import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';
import { AuditInfoComponent } from './AuditInfoComponent.js';
import { ProgressBarComponent } from './ProgressBarComponent.js';
import "../../css/components/audit_overview_component.css";

export const AuditOverviewComponent = {
    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;

        // Extract dependencies for easier access
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

        // Internal state
        this.unsubscribe_from_store_function = null;
        this.audit_info_container_element = null;
        this.scoreAnalysisContainerElement = null;
        this.previously_focused_element = null;

        this.global_message_element_ref = this.NotificationComponent.get_global_message_element_reference();

        // Bind methods
        this.handle_store_update = this.handle_store_update.bind(this);

        await this.init_sub_components();

        if (!this.unsubscribe_from_store_function && typeof this.subscribe === 'function') {
            this.unsubscribe_from_store_function = this.subscribe(this.handle_store_update);
        }
    },

    async init_sub_components() {
        this.audit_info_container_element = this.Helpers.create_element('div', { id: 'audit-info-component-container', class_name: 'dashboard-panel' });
        await AuditInfoComponent.init({
            root: this.audit_info_container_element,
            deps: {
                router: this.router,
                getState: this.getState,
                Translation: this.Translation,
                Helpers: this.Helpers
            }
        });

        this.scoreAnalysisContainerElement = this.Helpers.create_element('div', { id: 'score-analysis-component-container' });
        await ScoreAnalysisComponent.init({
            root: this.scoreAnalysisContainerElement,
            deps: {
                Helpers: this.Helpers,
                Translation: this.Translation,
                getState: this.getState,
                ScoreCalculator: window.ScoreCalculator // ScoreCalculator seems to be global, or we could look for it in deps if main.js passes it
            }
        });
    },

    handle_store_update(new_state) {
        // Handled by main.js subscription triggering render()
    },


    render() {
        const t = this.Translation.t;
        this.root.innerHTML = '';

        const current_global_state = this.getState();

        if (!current_global_state || !current_global_state.ruleFileContent) {
            // Anropa inte NotificationComponent här om elementet inte är redo eller root är fel
            if (this.root) {
                this.root.innerHTML = '';
                const error_div = this.Helpers.create_element('div', { class_name: 'content-plate' });
                error_div.textContent = t("error_no_active_audit");
                this.root.appendChild(error_div);
            }
            return;
        }

        const plate_element = this.Helpers.create_element('div', { class_name: 'content-plate audit-overview-plate' });
        this.root.appendChild(plate_element);

        if (this.global_message_element_ref) {
            plate_element.appendChild(this.global_message_element_ref);
        }
        plate_element.appendChild(this.Helpers.create_element('h1', { text_content: t('audit_overview_title') }));

        const dashboard_container = this.Helpers.create_element('div', { class_name: 'overview-dashboard' });

        const score_panel = this.Helpers.create_element('div', { class_name: ['dashboard-panel', 'score-panel'] });
        score_panel.appendChild(this.Helpers.create_element('h2', {
            class_name: 'dashboard-panel__title',
            text_content: t('result_summary_and_deficiency_analysis', { defaultValue: "Result Summary" })
        }));

        const progress_data = this.AuditLogic.calculate_overall_audit_progress(current_global_state);
        const lang_code = this.Translation.get_current_language_code();
        const percentage = (progress_data.total > 0) ? (progress_data.audited / progress_data.total) * 100 : 0;
        const formatted_percentage = this.Helpers.format_number_locally(percentage, lang_code, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const valueText = `${progress_data.audited} / ${progress_data.total} (${formatted_percentage} %)`;

        score_panel.appendChild(this.Helpers.create_element('h3', {
            class_name: 'dashboard-panel__subtitle',
            text_content: t('total_audit_progress_header', { defaultValue: "Klart hittills" })
        }));
        const progress_container = this.Helpers.create_element('div', { class_name: 'info-item--progress-container' });
        progress_container.appendChild(this.Helpers.create_element('p', { class_name: 'progress-text-wrapper', html_content: `<strong>${t('total_requirements_audited_label')}:</strong><span class="value">${valueText}</span>` }));

        if (ProgressBarComponent) {
            progress_container.appendChild(ProgressBarComponent.create(progress_data.audited, progress_data.total));
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

        // Granskningsinfo efter resultatsammanfattningen (kompakt vy)
        if (this.audit_info_container_element) {
            dashboard_container.appendChild(this.audit_info_container_element);
            AuditInfoComponent.render();
        }

        plate_element.appendChild(dashboard_container);
    },

    destroy() {
        if (this.unsubscribe_from_store_function) {
            this.unsubscribe_from_store_function();
            this.unsubscribe_from_store_function = null;
        }
        AuditInfoComponent.destroy();
        ScoreAnalysisComponent.destroy();

        this.scoreAnalysisContainerElement = null;
        this.audit_info_container_element = null;
        this.previously_focused_element = null;

        this.root = null;
        this.deps = null;
        // clear other deps
    }
};
