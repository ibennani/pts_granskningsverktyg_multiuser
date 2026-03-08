// js/components/BackupSettingsViewComponent.js
// Egen vy för inställningar för säkerhetskopior (schema + retention).

import { get_backup_settings, update_backup_settings } from '../api/client.js';

const RUNS_PER_DAY_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function get_schedule_summary(runs_per_day, first_run_hour) {
    const hours = [];
    for (let i = 0; i < runs_per_day; i++) {
        hours.push(Math.floor((first_run_hour + (24 * i) / runs_per_day) % 24));
    }
    hours.sort((a, b) => a - b);
    return hours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ');
}

export const BackupSettingsViewComponent = {
    CSS_PATH: 'css/components/backup_settings_view_component.css',

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.router = deps.router;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.NotificationComponent = deps.NotificationComponent;
        this.settings = null;
        this._save_in_progress = false;

        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
        this._handle_save = this._handle_save.bind(this);
        this._handle_back = this._handle_back.bind(this);
        this._handle_runs_change = this._handle_runs_change.bind(this);
        this._handle_hour_change = this._handle_hour_change.bind(this);
    },

    destroy() {
        this.root = null;
        this.deps = null;
        this.router = null;
    },

    get_t() {
        return this.Translation?.t ? this.Translation.t.bind(this.Translation) : (k) => k;
    },

    async _load_settings() {
        try {
            this.settings = await get_backup_settings();
        } catch {
            this.settings = {
                retention_days: 30,
                runs_per_day: 4,
                first_run_hour: 0
            };
        }
    },

    _handle_back() {
        if (typeof this.router === 'function') {
            this.router('backup', {});
        }
    },

    _handle_runs_change() {
        this._update_summary();
    },

    _handle_hour_change() {
        this._update_summary();
    },

    _update_summary() {
        if (!this.summary_ref) return;
        const runs = parseInt(this.runs_select_ref?.value ?? '4', 10);
        const hour = parseInt(this.hour_select_ref?.value ?? '0', 10);
        const t = this.get_t();
        const times = get_schedule_summary(runs, hour);
        this.summary_ref.textContent = t('backup_settings_schedule_summary', { count: runs, times }) || `Backup körs ${runs} gånger per dygn: ${times}`;
    },

    async _handle_save() {
        const t = this.get_t();
        if (this._save_in_progress) return;
        const retention_raw = this.retention_input_ref?.value?.trim() ?? '';
        const retention = retention_raw === '' ? NaN : parseInt(retention_raw, 10);
        if (!Number.isInteger(retention) || retention < 1 || retention > 365) {
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(t('backup_settings_retention_invalid'), 'warning');
            }
            return;
        }
        const runs_per_day = parseInt(this.runs_select_ref?.value ?? '4', 10);
        const first_run_hour = parseInt(this.hour_select_ref?.value ?? '0', 10);
        this._save_in_progress = true;
        try {
            await update_backup_settings({
                retention_days: retention,
                runs_per_day,
                first_run_hour
            });
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(t('backup_settings_saved_ok'), 'success');
            }
            await this._load_settings();
            if (this.root) this.render();
        } catch (err) {
            if (this.NotificationComponent?.show_global_message) {
                this.NotificationComponent.show_global_message(t('backup_settings_save_error') || err.message, 'error');
            }
        } finally {
            this._save_in_progress = false;
        }
    },

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;
        const t = this.get_t();

        if (!this.settings) {
            await this._load_settings();
        }
        const s = this.settings || { retention_days: 30, runs_per_day: 4, first_run_hour: 0 };

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate backup-settings-plate' });

        plate.appendChild(this.Helpers.create_element('h1', {
            id: 'main-content-heading',
            text_content: t('backup_settings_view_title'),
            attributes: { tabindex: '-1' }
        }));

        const intro = this.Helpers.create_element('p', {
            class_name: 'backup-settings-intro',
            text_content: t('backup_settings_view_intro')
        });
        plate.appendChild(intro);

        const form = this.Helpers.create_element('div', { class_name: 'backup-settings-form' });

        const schedule_heading = this.Helpers.create_element('h2', { text_content: t('backup_settings_schedule_heading') });
        form.appendChild(schedule_heading);

        const schedule_info = this.Helpers.create_element('p', {
            class_name: 'form-help',
            text_content: t('backup_settings_schedule_info')
        });
        form.appendChild(schedule_info);

        const runs_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        runs_group.appendChild(this.Helpers.create_element('label', {
            text_content: t('backup_settings_runs_per_day_label'),
            attributes: { for: 'backup-settings-runs' }
        }));
        this.runs_select_ref = this.Helpers.create_element('select', {
            attributes: { id: 'backup-settings-runs', 'aria-describedby': 'backup-settings-runs-help' },
            class_name: 'form-control'
        });
        RUNS_PER_DAY_OPTIONS.forEach((n) => {
            const opt = this.Helpers.create_element('option', { attributes: { value: String(n) }, text_content: String(n) });
            if (n === s.runs_per_day) opt.selected = true;
            this.runs_select_ref.appendChild(opt);
        });
        runs_group.appendChild(this.runs_select_ref);
        const runs_help = this.Helpers.create_element('p', { class_name: 'form-help', text_content: t('backup_settings_runs_help'), attributes: { id: 'backup-settings-runs-help' } });
        runs_group.appendChild(runs_help);
        form.appendChild(runs_group);

        const hour_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        hour_group.appendChild(this.Helpers.create_element('label', {
            text_content: t('backup_settings_first_run_label'),
            attributes: { for: 'backup-settings-hour' }
        }));
        this.hour_select_ref = this.Helpers.create_element('select', {
            attributes: { id: 'backup-settings-hour' },
            class_name: 'form-control'
        });
        HOURS.forEach((h) => {
            const opt = this.Helpers.create_element('option', {
                attributes: { value: String(h) },
                text_content: `${String(h).padStart(2, '0')}:00`
            });
            if (h === s.first_run_hour) opt.selected = true;
            this.hour_select_ref.appendChild(opt);
        });
        hour_group.appendChild(this.hour_select_ref);
        form.appendChild(hour_group);

        this.summary_ref = this.Helpers.create_element('p', { class_name: 'backup-settings-summary' });
        const times = get_schedule_summary(s.runs_per_day, s.first_run_hour);
        this.summary_ref.textContent = t('backup_settings_schedule_summary', { count: s.runs_per_day, times }) || `Backup körs ${s.runs_per_day} gånger per dygn: ${times}`;
        form.appendChild(this.summary_ref);

        this.runs_select_ref.addEventListener('change', this._handle_runs_change);
        this.hour_select_ref.addEventListener('change', this._handle_hour_change);

        const retention_heading = this.Helpers.create_element('h2', { text_content: t('backup_settings_retention_heading') });
        form.appendChild(retention_heading);

        const retention_group = this.Helpers.create_element('div', { class_name: 'form-group' });
        retention_group.appendChild(this.Helpers.create_element('label', {
            text_content: t('backup_settings_retention_label'),
            attributes: { for: 'backup-settings-retention' }
        }));
        this.retention_input_ref = this.Helpers.create_element('input', {
            attributes: {
                type: 'number',
                id: 'backup-settings-retention',
                min: '1',
                max: '365',
                value: String(s.retention_days),
                'aria-describedby': 'backup-settings-retention-help'
            },
            class_name: 'form-control'
        });
        retention_group.appendChild(this.retention_input_ref);
        retention_group.appendChild(this.Helpers.create_element('p', {
            class_name: 'form-help',
            text_content: t('backup_settings_retention_help'),
            attributes: { id: 'backup-settings-retention-help' }
        }));
        form.appendChild(retention_group);

        const btn_row = this.Helpers.create_element('div', { class_name: 'backup-settings-buttons' });
        const save_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-primary'],
            text_content: this._save_in_progress ? t('backup_settings_saving') : t('backup_settings_save'),
            attributes: { type: 'button' }
        });
        save_btn.addEventListener('click', this._handle_save);
        const back_btn = this.Helpers.create_element('button', {
            class_name: ['button', 'button-secondary'],
            text_content: t('backup_settings_back_to_list'),
            attributes: { type: 'button' }
        });
        back_btn.addEventListener('click', this._handle_back);
        btn_row.appendChild(save_btn);
        btn_row.appendChild(back_btn);
        form.appendChild(btn_row);

        plate.appendChild(form);
        this.root.appendChild(plate);
    }
};
