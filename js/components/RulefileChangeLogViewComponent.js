// js/components/RulefileChangeLogViewComponent.js

import { render_rulefile_change_log } from '../logic/rulefile_change_log_renderer.js';
import { get_server_filename_datetime } from '../utils/download_filename_utils.ts';

export class RulefileChangeLogViewComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.router = null;
        this.getState = null;
        this.Translation = null;
        this.Helpers = null;
        this.NotificationComponent = null;
        this.plate_element_ref = null;
    }

    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.getState = deps.getState;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.NotificationComponent = deps.NotificationComponent;

        this.plate_element_ref = null;
    }

    render() {
        if (!this.root) return;
        const t = this.Translation.t;
        const state = this.getState();
        const log = state.lastRulefileUpdateLog || null;

        this.root.innerHTML = '';
        this.plate_element_ref = this.Helpers.create_element('div', { class_name: 'content-plate' });
        this.root.appendChild(this.plate_element_ref);

        this.plate_element_ref.appendChild(this.Helpers.create_element('h1', {
            text_content: t('rulefile_change_log_title')
        }));

        if (!log || !log.report) {
            this.plate_element_ref.appendChild(this.Helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: t('rulefile_change_log_empty')
            }));
            const back_btn = this.Helpers.create_element('button', {
                class_name: ['button', 'button-default'],
                text_content: t('back_to_audit_overview')
            });
            back_btn.addEventListener('click', () => this.router('audit_overview'));
            this.plate_element_ref.appendChild(back_btn);
            return;
        }

        this.plate_element_ref.appendChild(this.Helpers.create_element('p', {
            class_name: 'view-intro-text',
            text_content: t('rulefile_change_log_intro')
        }));

        const meta_p = this.Helpers.create_element('p', { class_name: 'text-muted' });
        const prev_version = log.previousRuleVersion || t('update_rulefile_version_unknown');
        const new_version = log.newRuleVersion || t('update_rulefile_version_unknown');
        meta_p.textContent = `${t('update_rulefile_version_current_prefix')}${prev_version}  •  ${t('update_rulefile_version_new_prefix')}${new_version}`;
        this.plate_element_ref.appendChild(meta_p);

        const log_container = this.Helpers.create_element('div', {
            class_name: 'rulefile-change-log'
        });
        this.plate_element_ref.appendChild(log_container);

        const old_reqs = (state.ruleFileContent && state.ruleFileContent.requirements) || {};
        const new_reqs = (state.ruleFileContent && state.ruleFileContent.requirements) || {};

        render_rulefile_change_log({
            container: log_container,
            t,
            Helpers: this.Helpers,
            report: log.report,
            old_requirements: old_reqs,
            new_requirements: new_reqs
        });

        const actions = this.Helpers.create_element('div', { class_name: 'form-actions', style: { marginTop: '2rem' } });

        const back_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('back_to_audit_overview')
        });
        back_button.addEventListener('click', () => this.router('audit_overview'));

        const download_log_button = this.Helpers.create_element('button', {
            class_name: ['button', 'button-default'],
            text_content: t('update_rulefile_download_change_log_button')
        });
        download_log_button.addEventListener('click', async () => {
            const ts = await get_server_filename_datetime(log.createdAt || null) ||
                await get_server_filename_datetime(null);
            const filename = `rulefile_change_log_${ts || 'saknad-tidpunkt'}.json`;
            const payload = {
                previousRuleVersion: prev_version,
                newRuleVersion: new_version,
                createdAt: log.createdAt || null,
                report: log.report
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        actions.append(back_button, download_log_button);
        this.plate_element_ref.appendChild(actions);
    }

    destroy() {
        if (this.root) {
            this.root.innerHTML = '';
        }
        this.plate_element_ref = null;
        this.root = null;
        this.deps = null;
    }
}
