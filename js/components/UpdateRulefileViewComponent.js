// js/components/UpdateRulefileViewComponent.js
import { migrate_rulefile_to_new_structure } from '../logic/rulefile_migration_logic.js';
import { get_rule } from '../api/client.js';
import { render_rulefile_change_log } from '../logic/rulefile_change_log_renderer.js';
import './update_rulefile_view.css';

export const UpdateRulefileViewComponent = {
    CSS_PATH: './update_rulefile_view.css',
    VIEW_STEPS: {
        WARNING: 'WARNING',
        UPLOAD: 'UPLOAD',
        CONFIRM: 'CONFIRM'
    },

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.dispatch = deps.dispatch;
        this.StoreActionTypes = deps.StoreActionTypes;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;
        this.SaveAuditLogic = deps.SaveAuditLogic;
        this.ValidationLogic = deps.ValidationLogic || window.ValidationLogic;
        this.AuditLogic = deps.AuditLogic;

        const rule_id = deps.params?.ruleId;
        if (!rule_id) {
            this.router('audit_overview');
            return;
        }
        const _as = deps.getState?.()?.auditStatus;
        if (_as === 'locked' || _as === 'archived') {
            this.router('audit_overview');
            return;
        }
        this.rule_id_from_params = rule_id;
        this.new_rule_version_from_params = (deps.params?.version || '').trim() || null;

        this.current_step = this.VIEW_STEPS.WARNING;
        this.staged_new_rule_file_content = null;
        this.staged_analysis_report = null;
        this.plate_element_ref = null;
        this._loading_server_rule = false;
        this._backup_saved = false;
        this._analysis_ready = false;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            try {
                const link_tag = document.querySelector(`link[href="${this.CSS_PATH}"]`);
                if (!link_tag) {
                    await this.Helpers.load_css(this.CSS_PATH);
                }
            } catch (error) {
                if (window.ConsoleManager?.warn) window.ConsoleManager.warn("CSS for UpdateRulefileViewComponent not found yet, skipping load.", error);
            }
        }
    },

    get_t_internally() {
        return this.Translation?.t || ((key) => `**${key}**`);
    },

    handle_backup_click() {
        const t = this.get_t_internally();
        if (this.SaveAuditLogic?.save_audit_to_json_file) {
            const show_msg = (msg, type) => this.NotificationComponent?.show_global_message?.(msg, type);
            this.SaveAuditLogic.save_audit_to_json_file(
                this.getState(),
                t,
                show_msg,
                { backup_suffix_key: 'filename_backup_suffix' }
            );
            this._backup_saved = true;
            this.current_step = this.VIEW_STEPS.UPLOAD;
            this.render();
        } else {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("SaveAuditLogic not available to perform backup.");
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(t('error_saving_audit'), 'error');
            }
        }
    },

    handle_skip_backup_click() {
        this._backup_saved = false;
        this._analysis_ready = false;
        this.current_step = this.VIEW_STEPS.UPLOAD;
        this.render();
    },

    async handle_use_rule_from_server_click() {
        const t = this.get_t_internally();
        if (!window.RulefileUpdaterLogic) {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn("CRITICAL: RulefileUpdaterLogic is not available on the window object.");
            this.NotificationComponent?.show_global_message(t('error_internal_reload'), 'error');
            return;
        }
        this._analysis_ready = false;
        this._loading_server_rule = true;
        this.render();
        try {
            const rule_row = await get_rule(this.rule_id_from_params);
            // Uppdatering av regelfil i en granskning ska alltid använda publicerad version.
            let content = rule_row?.published_content ?? rule_row?.content;
            if (typeof content === 'string') {
                try {
                    content = JSON.parse(content);
                } catch {
                    content = null;
                }
            }
            if (!content || typeof content !== 'object') {
                this.NotificationComponent?.show_global_message(t('rule_file_invalid_json'), 'error');
                return;
            }
            const new_rule_content = migrate_rulefile_to_new_structure(content, {
                Translation: this.Translation
            });
            const validation = this.ValidationLogic?.validate_rule_file_json(new_rule_content, {
                t
            });
            if (validation && !validation.isValid) {
                this.NotificationComponent?.show_global_message(validation.message, 'error');
                return;
            }
            const report = window.RulefileUpdaterLogic.analyze_rule_file_changes(this.getState(), new_rule_content);
            this.staged_analysis_report = report;
            this.staged_new_rule_file_content = new_rule_content;
            this._analysis_ready = true;
            this._loading_server_rule = false;
            this.render();
        } catch (error) {
            this._loading_server_rule = false;
            this._analysis_ready = false;
            this.render();
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[UpdateRulefileViewComponent] handle_use_rule_from_server_click:', error);
            const is_network_error = /failed to fetch|networkerror|network error|load failed/i.test(error?.message || '') ||
                (error?.name && /network|typeerror/i.test(error.name));
            const message = is_network_error
                ? t('error_rulefile_update_network')
                : t('error_rulefile_update_failed') + (error?.message ? `: ${error.message}` : '');
            this.NotificationComponent?.show_global_message(message, 'error');
        }
    },

    handle_go_to_confirm_step_click() {
        if (!this._analysis_ready || !this.staged_analysis_report || !this.staged_new_rule_file_content) return;
        this.current_step = this.VIEW_STEPS.CONFIRM;
        this.render();
    },

    handle_download_change_log_click() {
        const t = this.get_t_internally();
        if (!this.staged_analysis_report || !this.staged_new_rule_file_content) return;

        const current_state = this.getState();
        const previous_version = (current_state?.ruleFileContent?.metadata?.version || '').trim() || t('update_rulefile_version_unknown');
        const new_version = (this.staged_new_rule_file_content?.metadata?.version || '').trim() || t('update_rulefile_version_unknown');

        const report = this.staged_analysis_report;
        const added = Array.isArray(report.added_requirements) ? report.added_requirements : [];
        const removed = Array.isArray(report.removed_requirements) ? report.removed_requirements : [];
        const updated = Array.isArray(report.updated_requirements) ? report.updated_requirements : [];

        const lines = [];
        lines.push(t('update_rulefile_change_log_title'));
        lines.push('');
        lines.push(`${t('update_rulefile_version_current_prefix')}${previous_version}`);
        lines.push(`${t('update_rulefile_version_new_prefix')}${new_version}`);
        lines.push('');
        lines.push(`${t('update_rulefile_change_log_section_added')} (${added.length})`);
        added.forEach((item) => {
            lines.push(`- ${item.title || item.id}`);
        });
        lines.push('');
        lines.push(`${t('update_rulefile_change_log_section_removed')} (${removed.length})`);
        removed.forEach((item) => {
            lines.push(`- ${item.title || item.id}`);
        });
        lines.push('');
        lines.push(`${t('update_rulefile_change_log_section_updated')} (${updated.length})`);
        updated.forEach((item) => {
            lines.push(`- ${item.title || item.id}`);
        });

        const text_content = lines.join('\n');
        const blob = new Blob([text_content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const date_str = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
        a.download = `rulefile_change_log_${date_str}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    handle_confirm_update_click() {
        const t = this.get_t_internally();
        if (!this.staged_new_rule_file_content || !this.staged_analysis_report) {
            const errorMsg = t('error_confirm_failed_temp_data_missing');
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn(errorMsg);
            this.NotificationComponent?.show_global_message(t('error_internal'), 'error');
            return;
        }

        const final_reconciled_state = window.RulefileUpdaterLogic.apply_rule_file_update(
            this.getState(),
            this.staged_new_rule_file_content,
            this.staged_analysis_report
        );

        const state_with_recalculated_statuses = this.AuditLogic?.recalculateStatusesOnLoad
            ? this.AuditLogic.recalculateStatusesOnLoad(final_reconciled_state)
            : final_reconciled_state;

        // Antal krav som har needsReview och en tydlig bedömning (godkänd/underkänd) – det som faktiskt behöver bekräftas.
        const requirements = state_with_recalculated_statuses?.ruleFileContent?.requirements;
        let needs_review_count = 0;
        (state_with_recalculated_statuses.samples || []).forEach(sample => {
            Object.keys(sample.requirementResults || {}).forEach(reqId => {
                if (sample.requirementResults[reqId]?.needsReview !== true) return;
                const req_def = requirements && (Array.isArray(requirements) ? requirements.find(r => (r?.key || r?.id) === reqId) : requirements[reqId]);
                if (!req_def) return;
                const display_status = this.AuditLogic?.calculate_requirement_status
                    ? this.AuditLogic.calculate_requirement_status(req_def, sample.requirementResults[reqId])
                    : (sample.requirementResults[reqId]?.status || 'not_audited');
                if (display_status === 'passed' || display_status === 'failed') needs_review_count++;
            });
        });

        this.dispatch({
            type: this.StoreActionTypes.REPLACE_RULEFILE_AND_RECONCILE,
            payload: state_with_recalculated_statuses
        });

        if (needs_review_count > 0) {
            this.NotificationComponent?.show_global_message(t('update_rulefile_success_needs_review', { count: needs_review_count }), 'success');
            this.router('confirm_updates');
        } else {
            this.NotificationComponent?.show_global_message(t('update_rulefile_success'), 'success');
            this.router('audit_overview');
        }
    },

    render() {
        if (!this.root) return;
        
        if (!this.plate_element_ref || !this.root.contains(this.plate_element_ref)) {
            this.root.innerHTML = '';
            this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate update-rulefile-view-plate' });
            this.root.appendChild(this.plate_element_ref);
        }
        
        this.plate_element_ref.innerHTML = '';

        if (this.NotificationComponent?.append_global_message_areas_to) {
            this.NotificationComponent.append_global_message_areas_to(this.plate_element_ref);
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('h1', { text_content: this.get_t_internally()('update_rulefile_title') }));

        switch (this.current_step) {
            case this.VIEW_STEPS.WARNING:
                this.render_warning_step();
                break;
            case this.VIEW_STEPS.UPLOAD:
                this.render_upload_step();
                break;
            case this.VIEW_STEPS.CONFIRM:
                this.render_confirm_step(this.staged_analysis_report);
                break;
        }
    },

    render_warning_step() {
        const t = this.get_t_internally();
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('update_rulefile_warning_intro') }));
        
        const warning_list = this.Helpers.create_element('ul', { class_name: 'warning-list' });
        warning_list.innerHTML = `
            <li>${t('update_rulefile_warning_li1')}</li>
            <li>${t('update_rulefile_warning_li2')}</li>
        `;
        this.plate_element_ref.appendChild(warning_list);

        this.plate_element_ref.appendChild(this.Helpers.create_element('h2', { style: { 'font-size': '1.2rem', 'margin-top': '1.5rem' }, text_content: t('update_rulefile_recommendation') }));
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { text_content: t('update_rulefile_backup_text') }));

        const backup_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            html_content: `<span>${t('save_audit_to_file')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('save') : '')
        });
        backup_button.addEventListener('click', () => this.handle_backup_click());

        const skip_backup_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('update_rulefile_skip_backup')
        });
        skip_backup_button.addEventListener('click', () => this.handle_skip_backup_click());

        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('back_to_audit_overview')
        });
        back_button.addEventListener('click', () => this.router('audit_overview'));

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        actions_div.append(backup_button, skip_backup_button, back_button);
        this.plate_element_ref.appendChild(actions_div);
    },
    
    render_upload_step() {
        const t = this.get_t_internally();
        const current_version = (this.getState()?.ruleFileContent?.metadata?.version || '').trim() || t('update_rulefile_version_unknown');
        const new_version = (this.new_rule_version_from_params || '').trim() || t('update_rulefile_version_unknown');

        if (this._backup_saved === true && !this._loading_server_rule) {
            this.plate_element_ref.appendChild(this.Helpers.create_element('div', {
                class_name: 'backup-confirmation',
                html_content: (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle') : '✔') + ` <span>${t('update_rulefile_backup_saved')}</span>`
            }));
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('h2', { style: { 'font-size': '1.2rem', 'margin-top': '1.5rem' }, text_content: t('update_rulefile_step2_title') }));
        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { text_content: t('update_rulefile_step2_intro') }));

        const versions_ul = this.Helpers.create_element('ul', { class_name: 'version-list' });
        const current_li = this.Helpers.create_element('li');
        current_li.appendChild(document.createTextNode(t('update_rulefile_version_current_prefix')));
        current_li.appendChild(this.Helpers.create_element('strong', { text_content: current_version }));
        versions_ul.appendChild(current_li);

        const new_li = this.Helpers.create_element('li');
        new_li.appendChild(document.createTextNode(t('update_rulefile_version_new_prefix')));
        new_li.appendChild(this.Helpers.create_element('strong', { text_content: new_version }));
        versions_ul.appendChild(new_li);
        this.plate_element_ref.appendChild(versions_ul);

        if (this._analysis_ready && this.staged_analysis_report) {
            const report = this.staged_analysis_report;
            this.plate_element_ref.appendChild(this.Helpers.create_element('p', { text_content: t('update_rulefile_changes_summary_intro') }));
            const counts_ul = this.Helpers.create_element('ul', { class_name: 'change-count-list' });
            counts_ul.appendChild(this.Helpers.create_element('li', { text_content: t('update_rulefile_count_added', { count: (report.added_requirements || []).length }) }));
            counts_ul.appendChild(this.Helpers.create_element('li', { text_content: t('update_rulefile_count_updated', { count: (report.updated_requirements || []).length }) }));
            counts_ul.appendChild(this.Helpers.create_element('li', { text_content: t('update_rulefile_count_removed', { count: (report.removed_requirements || []).length }) }));
            this.plate_element_ref.appendChild(counts_ul);
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('p', { class_name: 'view-intro-text', text_content: t('update_rulefile_step2_confirm_notice') }));

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });
        if (this._loading_server_rule) {
            const loading_p = this.Helpers.create_element('p', {
                class_name: 'update-rulefile-loading',
                text_content: t('update_rulefile_loading_server'),
                attributes: { 'aria-live': 'polite' }
            });
            actions_div.appendChild(loading_p);
        } else {
            if (this._analysis_ready) {
                const review_report_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    text_content: t('update_rulefile_review_report')
                });
                review_report_button.addEventListener('click', () => this.handle_go_to_confirm_step_click());

                const analyze_again_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-default'],
                    text_content: t('update_rulefile_analyze_again')
                });
                analyze_again_button.addEventListener('click', () => this.handle_use_rule_from_server_click());

                actions_div.append(review_report_button, analyze_again_button);
            } else {
                const use_server_button = this.Helpers.create_element('button', {
                    class_name: ['button', 'button-primary'],
                    html_content: `<span>${t('update_rulefile_use_from_server')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('upload_file') : '')
                });
                use_server_button.addEventListener('click', () => this.handle_use_rule_from_server_click());
                actions_div.appendChild(use_server_button);
            }
        }

        this.plate_element_ref.appendChild(actions_div);
    },

    render_confirm_step(report) {
        const t = this.get_t_internally();
        const state = this.getState();
        const old_reqs = state.ruleFileContent.requirements || {};
        const new_reqs = this.staged_new_rule_file_content?.requirements || {};

        const confirm_intro = this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('update_rulefile_confirm_intro')
        });
        confirm_intro.setAttribute('aria-live', 'polite');
        this.plate_element_ref.appendChild(confirm_intro);

        const change_log_title = this.Helpers.create_element('h2', {
            text_content: t('update_rulefile_change_log_title'),
            style: { 'font-size': '1.2rem', 'margin-top': '1.5rem' }
        });
        this.plate_element_ref.appendChild(change_log_title);

        const change_log_intro = this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('update_rulefile_change_log_intro')
        });
        this.plate_element_ref.appendChild(change_log_intro);

        const log_container = this.Helpers.create_element('div', {
            class_name: 'rulefile-change-log'
        });
        this.plate_element_ref.appendChild(log_container);

        render_rulefile_change_log({
            container: log_container,
            t,
            Helpers: this.Helpers,
            report: report,
            old_requirements: old_reqs,
            new_requirements: new_reqs
        });

        const confirm_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-success'],
            html_content: `<span>${t('update_rulefile_confirm_button')}</span>` + (this.Helpers.get_icon_svg ? this.Helpers.get_icon_svg('check_circle') : '')
        });
        confirm_button.addEventListener('click', () => this.handle_confirm_update_click());

        const download_log_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('update_rulefile_download_change_log_button')
        });
        download_log_button.addEventListener('click', () => this.handle_download_change_log_click());

        const cancel_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('update_rulefile_continue_with_old')
        });
        cancel_button.addEventListener('click', () => this.router('audit_overview'));

        const actions_div = this.Helpers.create_element('div', { class_name: 'form-actions', style: { 'margin-top': '2rem' } });

        actions_div.append(confirm_button, download_log_button, cancel_button);
        this.plate_element_ref.appendChild(actions_div);
    },

    destroy() {
        if (this.root) this.root.innerHTML = '';
        this.plate_element_ref = null;
        this.current_step = this.VIEW_STEPS.WARNING;
        this.staged_analysis_report = null;
        this.staged_new_rule_file_content = null;
        this._loading_server_rule = false;
        this._backup_saved = false;
        this._analysis_ready = false;
        this.root = null;
        this.deps = null;
    }
};
