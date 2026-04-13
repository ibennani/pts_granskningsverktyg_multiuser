/**
 * Vy för aggregerad statistik över avslutade granskningar.
 */
import { get_audit_statistics_summary } from '../api/client.js';
import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';
import {
    append_statistics_sampletype_chart_block,
    append_statistics_score_analysis_block,
    append_statistics_top_failed_block,
    build_statistics_summary_list
} from './statistics_view_sections.js';
import './statistics_view_component.css';

const MONITORING_FALLBACK_SENTINEL = '__GV_STATS_MONITORING_FALLBACK__';

export class StatisticsViewComponent {
    constructor() {
        this.CSS_PATH = './statistics_view_component.css';
        this.root = null;
        this.deps = null;
        this.Translation = null;
        this.Helpers = null;
        this.router = null;
        this.year_select_ref = null;
        this.monitoring_type_select_ref = null;
        this._fetch_error = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.router = deps.router;
        this._fetch_error = null;
        if (this.Helpers?.load_css && this.CSS_PATH) {
            await this.Helpers.load_css(this.CSS_PATH).catch(() => {});
        }
    }

    destroy() {
        ScoreAnalysisComponent.destroy();
        this.year_select_ref = null;
        this.monitoring_type_select_ref = null;
        this.root = null;
        this.deps = null;
    }

    _monitoring_heading(raw) {
        const t = this.Translation.t;
        return raw === MONITORING_FALLBACK_SENTINEL ? t('statistics_monitoring_fallback_label') : raw;
    }

    _completed_strong_text(t, count) {
        if (count === 1) return t('statistics_summary_completed_singular');
        return t('statistics_summary_completed_plural', { count: String(count) });
    }

    _empty_year_payload() {
        return {
            completed_count: 0,
            median_duration_weeks: null,
            monitoring_type_top_failed: [],
            principle_median_deficiency: {},
            total_median_deficiency: null,
            median_sample_count: null,
            worst_sample_type: null,
            monitoring_sampletype_chart: []
        };
    }

    /**
     * All visad statistik ska komma från per_monitoring_type för vald nyckel
     * (samma år som year_raw). Endast nycklar som har ett slice-objekt används.
     * @returns {{ year_data: object, selected_monitoring_key: string, should_sync_url: boolean, labels_with_data: string[] }}
     */
    _resolve_monitoring_slice(year_raw, params) {
        const ordered = Array.isArray(year_raw.monitoring_type_labels_ordered)
            ? year_raw.monitoring_type_labels_ordered
            : [];
        const pm =
            year_raw.per_monitoring_type && typeof year_raw.per_monitoring_type === 'object'
                ? year_raw.per_monitoring_type
                : {};
        const labels_with_data = ordered.filter(
            (k) => pm[k] !== undefined && pm[k] !== null && typeof pm[k] === 'object'
        );
        if (labels_with_data.length === 0) {
            return {
                year_data: this._empty_year_payload(),
                selected_monitoring_key: '',
                should_sync_url: false,
                labels_with_data: []
            };
        }
        const raw =
            params.monitoringType !== undefined && params.monitoringType !== null
                ? String(params.monitoringType).trim()
                : '';
        const want =
            raw && labels_with_data.includes(raw) ? raw : labels_with_data[0];
        const year_data = pm[want];
        const should_sync_url = String(params.monitoringType || '') !== String(want);
        return {
            year_data,
            selected_monitoring_key: want,
            should_sync_url,
            labels_with_data
        };
    }

    _statistics_nav_params(year_num, monitoring_key) {
        const out = { year: String(year_num) };
        if (monitoring_key) out.monitoringType = monitoring_key;
        return out;
    }

    _wire_statistics_year_select(Helpers, t, years, selected_year) {
        const year_field = Helpers.create_element('div', { class_name: 'statistics-filter-row__field' });
        year_field.appendChild(
            Helpers.create_element('label', {
                class_name: 'statistics-filter-row__label',
                attributes: { for: 'statistics-year-select' },
                text_content: t('statistics_year_label')
            })
        );
        this.year_select_ref = Helpers.create_element('select', {
            id: 'statistics-year-select',
            class_name: ['form-control', 'statistics-year-select']
        });
        years.forEach((y) => {
            this.year_select_ref.appendChild(
                Helpers.create_element('option', {
                    attributes: { value: String(y) },
                    text_content: String(y)
                })
            );
        });
        this.year_select_ref.value = String(selected_year);
        this.year_select_ref.addEventListener('change', () => {
            const y = parseInt(this.year_select_ref.value, 10);
            if (!years.includes(y)) return;
            this.router('statistics', { year: String(y) });
        });
        year_field.appendChild(this.year_select_ref);
        return year_field;
    }

    _wire_statistics_monitoring_select(Helpers, t, years, monitoring_labels, selected_monitoring_key) {
        const type_field = Helpers.create_element('div', { class_name: 'statistics-filter-row__field' });
        type_field.appendChild(
            Helpers.create_element('label', {
                class_name: 'statistics-filter-row__label',
                attributes: { for: 'statistics-rulefile-type-select' },
                text_content: t('statistics_rulefile_type_label')
            })
        );
        this.monitoring_type_select_ref = Helpers.create_element('select', {
            id: 'statistics-rulefile-type-select',
            class_name: ['form-control', 'statistics-monitoring-select']
        });
        monitoring_labels.forEach((key) => {
            this.monitoring_type_select_ref.appendChild(
                Helpers.create_element('option', {
                    attributes: { value: key },
                    text_content: this._monitoring_heading(key)
                })
            );
        });
        this.monitoring_type_select_ref.value = selected_monitoring_key;
        this.monitoring_type_select_ref.addEventListener('change', () => {
            const y = parseInt(this.year_select_ref?.value || '', 10);
            if (!years.includes(y)) return;
            const mk = this.monitoring_type_select_ref.value || '';
            if (!mk) return;
            this.router('statistics', this._statistics_nav_params(y, mk));
        });
        type_field.appendChild(this.monitoring_type_select_ref);
        return type_field;
    }

    _append_filters_section(plate, t, Helpers, years, selected_year, monitoring_labels, selected_monitoring_key) {
        const section = Helpers.create_element('div', {
            class_name: 'statistics-filters-section'
        });
        section.appendChild(
            Helpers.create_element('h2', {
                id: 'statistics-filters-heading',
                class_name: 'statistics-filters-section__h2',
                text_content: t('statistics_filters_section_heading')
            })
        );
        section.appendChild(
            Helpers.create_element('p', {
                class_name: 'view-intro-text statistics-filters-section__intro',
                text_content: t('statistics_filters_section_intro')
            })
        );
        const row = Helpers.create_element('div', { class_name: 'statistics-filter-row form-group' });
        row.appendChild(this._wire_statistics_year_select(Helpers, t, years, selected_year));
        row.appendChild(this._wire_statistics_monitoring_select(Helpers, t, years, monitoring_labels, selected_monitoring_key));
        section.appendChild(row);
        plate.appendChild(section);
    }

    _create_initial_plate(t, Helpers) {
        const plate = Helpers.create_element('div', { class_name: ['content-plate', 'statistics-plate'] });
        plate.appendChild(
            Helpers.create_element('h1', {
                id: 'main-content-heading',
                text_content: t('menu_link_statistics'),
                attributes: { tabindex: '-1' }
            })
        );
        plate.appendChild(
            Helpers.create_element('p', {
                class_name: 'view-intro-text',
                text_content: t('statistics_page_intro')
            })
        );
        const status_el = Helpers.create_element('div', {
            class_name: 'statistics-status',
            attributes: { role: 'status', 'aria-live': 'polite', 'aria-busy': 'true' },
            text_content: t('statistics_loading')
        });
        plate.appendChild(status_el);
        return { plate, status_el };
    }

    async render() {
        if (!this.root || !this.Helpers?.create_element) return;
        ScoreAnalysisComponent.destroy();
        const t = this.Translation.t;
        const Helpers = this.Helpers;
        const params = this.deps?.params || {};
        this.root.innerHTML = '';
        const { plate, status_el } = this._create_initial_plate(t, Helpers);
        this.root.appendChild(plate);

        let data;
        try {
            data = await get_audit_statistics_summary();
            this._fetch_error = null;
        } catch (err) {
            this._fetch_error = err?.message || t('statistics_error_generic');
            status_el.textContent = this._fetch_error;
            status_el.setAttribute('aria-busy', 'false');
            return;
        }

        status_el.setAttribute('aria-busy', 'false');
        status_el.textContent = '';
        status_el.className = 'visually-hidden';

        const years = data.available_years || [];
        if (years.length === 0) {
            plate.appendChild(
                Helpers.create_element('p', {
                    class_name: 'statistics-summary',
                    text_content: t('statistics_empty')
                })
            );
            return;
        }

        let selected = params.year ? parseInt(params.year, 10) : years[0];
        if (!years.includes(selected)) selected = years[0];

        const per = data.per_year || {};
        const year_raw = per[String(selected)] || this._empty_year_payload();

        const resolved = this._resolve_monitoring_slice(year_raw, params);
        if (resolved.should_sync_url && typeof this.router === 'function') {
            this.router(
                'statistics',
                this._statistics_nav_params(selected, resolved.selected_monitoring_key)
            );
            return;
        }

        const { year_data, selected_monitoring_key } = resolved;
        const monitoring_labels = resolved.labels_with_data;

        if (monitoring_labels.length === 0) {
            plate.appendChild(
                Helpers.create_element('p', {
                    class_name: 'statistics-summary',
                    text_content: t('statistics_no_rulefile_types_for_year')
                })
            );
            return;
        }

        this._append_filters_section(
            plate,
            t,
            Helpers,
            years,
            selected,
            monitoring_labels,
            selected_monitoring_key
        );

        const summary_wrap = Helpers.create_element('div', {
            class_name: 'statistics-summary'
        });
        summary_wrap.appendChild(
            Helpers.create_element('h2', {
                id: 'statistics-summary-heading',
                text_content: t('statistics_summary_section_heading')
            })
        );
        summary_wrap.appendChild(
            build_statistics_summary_list(t, this.Translation, Helpers, selected, year_data, (tr, c) =>
                this._completed_strong_text(tr, c)
            )
        );
        plate.appendChild(summary_wrap);

        append_statistics_score_analysis_block(plate, t, Helpers, this.Translation, year_data);

        append_statistics_sampletype_chart_block(
            plate,
            t,
            Helpers,
            year_data.monitoring_sampletype_chart,
            (lbl) => this._monitoring_heading(lbl)
        );

        append_statistics_top_failed_block(
            plate,
            t,
            Helpers,
            year_data.monitoring_type_top_failed || [],
            (lbl) => this._monitoring_heading(lbl)
        );
    }
}
