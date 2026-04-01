// js/components/BackupSettingsViewComponent.js
// Egen vy för inställningar för säkerhetskopior (schema + retention).

import { get_backup_settings, update_backup_settings } from '../api/client.js';
import { app_runtime_refs } from '../utils/app_runtime_refs.js';
import './backup_settings_view_component.css';

const RUNS_PER_DAY_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function compute_schedule_hours(first_run_hour, last_run_hour, runs_per_day) {
    const first = Math.max(0, Math.min(23, parseInt(first_run_hour, 10) || 0));
    const last = Math.max(0, Math.min(23, parseInt(last_run_hour, 10) || 0));
    const runs = Math.max(1, Math.min(24, parseInt(runs_per_day, 10) || 1));
    if (runs === 1) return [first];
    const span = last >= first ? last - first : 24 - first + last;
    const hours = [];
    for (let i = 0; i < runs; i++) {
        hours.push(Math.round((first + (i * span) / (runs - 1)) % 24));
    }
    return [...new Set(hours)].sort((a, b) => a - b);
}

function format_schedule_times(hours) {
    return hours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ');
}

export class BackupSettingsViewComponent {
    constructor() {
        this.CSS_PATH = './backup_settings_view_component.css';
        this.root = null;
        this.deps = null;
        this.router = null;
        this.Helpers = null;
        this.Translation = null;
        this.NotificationComponent = null;
        this.settings = null;
        this._save_in_progress = false;
    }

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
        this._handle_schedule_change = this._handle_schedule_change.bind(this);
    }

    destroy() {
        this.root = null;
        this.deps = null;
        this.router = null;
    }

    get_t() {
        return this.Translation?.t ? this.Translation.t.bind(this.Translation) : (k) => k;
    }

    async _load_settings() {
        try {
            this.settings = await get_backup_settings();
        } catch {
            this.settings = {
                retention_days: 30,
                runs_per_day: 4,
                first_run_hour: 0,
                last_run_hour: 18
            };
        }
    }

    _handle_back() {
        if (typeof this.router === 'function') {
            this.router('backup', {});
        }
    }

    _handle_schedule_change() {
        this._update_summary();
    }

    _update_summary() {
        if (!this.summary_ref) return;
        const runs = parseInt(this.runs_select_ref?.value ?? '4', 10);
        const first = parseInt(this.hour_select_ref?.value ?? '0', 10);
        const last = parseInt(this.last_hour_select_ref?.value ?? '18', 10);
        const t = this.get_t();
        const hours = compute_schedule_hours(first, last, runs);
        const times = format_schedule_times(hours);
        this.summary_ref.textContent = t('backup_settings_schedule_summary', { count: runs, times }) || `Backup körs ${runs} gånger per dygn: ${times}`;
    }

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
        const last_run_hour = parseInt(this.last_hour_select_ref?.value ?? '18', 10);
        this._save_in_progress = true;
        const show_msg = (msg, type) => {
            const nc = this.NotificationComponent || app_runtime_refs.notification_component;
            if (nc?.show_global_message) nc.show_global_message(msg, type);
        };
        const SAVE_TIMEOUT_MS = 15000;
        const save_promise = update_backup_settings({
            retention_days: retention,
            runs_per_day,
            first_run_hour,
            last_run_hour
        });
        const timeout_promise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(t('backup_settings_save_timeout'))), SAVE_TIMEOUT_MS);
        });
        try {
            await Promise.race([save_promise, timeout_promise]);
            if (typeof this.router === 'function') {
                try {
                    sessionStorage.setItem('gv_backup_settings_saved_message', 'backup_settings_saved_ok');
                } catch (_) {
                    // ignoreras medvetet
                }
                this.router('backup', {});
            } else {
                show_msg(t('backup_settings_saved_ok'), 'success');
                await this._load_settings();
                if (this.root) await this.render();
            }
        } catch (err) {
            const message = (err && err.message) || t('backup_settings_save_error');
            show_msg(message, 'error');
            if (this.root) await this.render();
        } finally {
            this._save_in_progress = false;
        }
    }

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;
        const t = this.get_t();

        if (!this.settings) {
            await this._load_settings();
        }
        const s = this.settings || { retention_days: 30, runs_per_day: 4, first_run_hour: 0, last_run_hour: 18 };

        this.root.innerHTML = '';
        const plate = this.Helpers.create_element('div', { class_name: 'content-plate backup-settings-plate' });

        if (this.NotificationComponent?.append_global_message_areas_to) {
            this.NotificationComponent.append_global_message_areas_to(plate);
        }

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
            class_name: 'backup-settings-schedule-info',
            text_content: t('backup_settings_schedule_info')
        });
        form.appendChild(schedule_info);

        const schedule_row = this.Helpers.create_element('div', { class_name: 'backup-settings-schedule-row' });

        const runs_group = this.Helpers.create_element('div', { class_name: 'backup-settings-schedule-field' });
        runs_group.appendChild(this.Helpers.create_element('label', {
            text_content: t('backup_settings_runs_per_day_label'),
            attributes: { for: 'backup-settings-runs' }
        }));
        this.runs_select_ref = this.Helpers.create_element('select', {
            attributes: { id: 'backup-settings-runs' },
            class_name: 'form-control'
        });
        RUNS_PER_DAY_OPTIONS.forEach((n) => {
            const opt = this.Helpers.create_element('option', { attributes: { value: String(n) }, text_content: String(n) });
            if (n === s.runs_per_day) opt.selected = true;
            this.runs_select_ref.appendChild(opt);
        });
        runs_group.appendChild(this.runs_select_ref);
        schedule_row.appendChild(runs_group);

        const hour_group = this.Helpers.create_element('div', { class_name: 'backup-settings-schedule-field' });
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
        schedule_row.appendChild(hour_group);

        const last_hour_group = this.Helpers.create_element('div', { class_name: 'backup-settings-schedule-field' });
        last_hour_group.appendChild(this.Helpers.create_element('label', {
            text_content: t('backup_settings_last_run_label'),
            attributes: { for: 'backup-settings-last-hour' }
        }));
        this.last_hour_select_ref = this.Helpers.create_element('select', {
            attributes: { id: 'backup-settings-last-hour' },
            class_name: 'form-control'
        });
        HOURS.forEach((h) => {
            const opt = this.Helpers.create_element('option', {
                attributes: { value: String(h) },
                text_content: `${String(h).padStart(2, '0')}:00`
            });
            if (h === (s.last_run_hour ?? 18)) opt.selected = true;
            this.last_hour_select_ref.appendChild(opt);
        });
        last_hour_group.appendChild(this.last_hour_select_ref);
        schedule_row.appendChild(last_hour_group);

        form.appendChild(schedule_row);

        this.summary_ref = this.Helpers.create_element('p', { class_name: 'backup-settings-summary' });
        const hours = compute_schedule_hours(s.first_run_hour, s.last_run_hour ?? 18, s.runs_per_day);
        const times = format_schedule_times(hours);
        this.summary_ref.textContent = t('backup_settings_schedule_summary', { count: s.runs_per_day, times }) || `Backup körs ${s.runs_per_day} gånger per dygn: ${times}`;
        form.appendChild(this.summary_ref);

        if (RUNS_PER_DAY_OPTIONS.includes(s.runs_per_day)) {
            this.runs_select_ref.value = String(s.runs_per_day);
        }
        this.hour_select_ref.value = String(s.first_run_hour);
        this.last_hour_select_ref.value = String(s.last_run_hour ?? 18);
        this.runs_select_ref.addEventListener('change', this._handle_schedule_change);
        this.hour_select_ref.addEventListener('change', this._handle_schedule_change);
        this.last_hour_select_ref.addEventListener('change', this._handle_schedule_change);

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
            text_content: t('backup_settings_back_without_save'),
            attributes: { type: 'button' }
        });
        back_btn.addEventListener('click', this._handle_back);
        btn_row.appendChild(save_btn);
        btn_row.appendChild(back_btn);
        form.appendChild(btn_row);

        plate.appendChild(form);
        this.root.appendChild(plate);
    }
}
