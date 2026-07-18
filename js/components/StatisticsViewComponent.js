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
const AUDIT_TYPE_FALLBACK_SENTINEL = '__GV_STATS_AUDIT_TYPE_FALLBACK__';
const STATISTICS_FILTER_EMPTY_VALUE = '';

export class StatisticsViewComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.Translation = null;
        this.Helpers = null;
        this.router = null;
        this.year_select_ref = null;
        this.monitoring_type_select_ref = null;
        this.audit_type_select_ref = null;
        this._fetch_error = null;
    }

    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Translation = deps.Translation;
        this.Helpers = deps.Helpers;
        this.router = deps.router;
        this._fetch_error = null;
    }

    destroy() {
        ScoreAnalysisComponent.destroy();
        this.year_select_ref = null;
        this.monitoring_type_select_ref = null;
        this.audit_type_select_ref = null;
        this.root = null;
        this.deps = null;
    }

    _monitoring_heading(raw) {
        const t = this.Translation.t;
        return raw === MONITORING_FALLBACK_SENTINEL ? t('statistics_monitoring_fallback_label') : raw;
    }

    _audit_type_heading(raw) {
        const t = this.Translation.t;
        return raw === AUDIT_TYPE_FALLBACK_SENTINEL ? t('statistics_audit_type_fallback_label') : raw;
    }

    _completed_strong_text(t, count) {
        if (count === 1) return t('statistics_summary_completed_singular');
        return t('statistics_summary_completed_plural', { count: String(count) });
    }

    _empty_slice_payload() {
        return {
            completed_count: 0,
            median_duration_weeks: null,
            monitoring_type_top_failed: [],
            principle_median_deficiency: {},
            principle_labels: {},
            grouping_taxonomy_id: '',
            grouping_taxonomy_label: '',
            total_median_deficiency: null,
            median_sample_count: null,
            worst_sample_type: null,
            monitoring_sampletype_chart: []
        };
    }

    _empty_year_payload() {
        return {
            monitoring_type_labels_ordered: [],
            per_monitoring_type: {}
        };
    }

    /**
     * @returns {{ monitoring_entry: object|null, selected_monitoring_key: string, labels_with_data: string[] }}
     */
    _resolve_monitoring_slice(year_raw, params) {
        const ordered = Array.isArray(year_raw.monitoring_type_labels_ordered)
            ? year_raw.monitoring_type_labels_ordered
            : [];
        const pm =
            year_raw.per_monitoring_type && typeof year_raw.per_monitoring_type === 'object'
                ? year_raw.per_monitoring_type
                : {};
        const labels_with_data = ordered.filter((k) => {
            const entry = pm[k];
            return (
                entry &&
                typeof entry === 'object' &&
                entry.per_audit_type &&
                typeof entry.per_audit_type === 'object' &&
                Object.keys(entry.per_audit_type).length > 0
            );
        });
        if (labels_with_data.length === 0) {
            return {
                monitoring_entry: null,
                selected_monitoring_key: '',
                labels_with_data: []
            };
        }
        const raw =
            params.monitoringType !== undefined && params.monitoringType !== null
                ? String(params.monitoringType).trim()
                : '';
        const selected_monitoring_key =
            raw && labels_with_data.includes(raw) ? raw : STATISTICS_FILTER_EMPTY_VALUE;
        const monitoring_entry = selected_monitoring_key ? pm[selected_monitoring_key] || null : null;
        return {
            monitoring_entry,
            selected_monitoring_key,
            labels_with_data
        };
    }

    /**
     * @returns {{ year_data: object|null, selected_audit_type_key: string, labels_with_data: string[] }}
     */
    _resolve_audit_type_slice(monitoring_entry, params) {
        if (!monitoring_entry) {
            return {
                year_data: null,
                selected_audit_type_key: STATISTICS_FILTER_EMPTY_VALUE,
                labels_with_data: []
            };
        }
        const ordered = Array.isArray(monitoring_entry.audit_type_labels_ordered)
            ? monitoring_entry.audit_type_labels_ordered
            : [];
        const pa =
            monitoring_entry.per_audit_type && typeof monitoring_entry.per_audit_type === 'object'
                ? monitoring_entry.per_audit_type
                : {};
        const labels_with_data = ordered.filter(
            (k) => pa[k] !== undefined && pa[k] !== null && typeof pa[k] === 'object'
        );
        if (labels_with_data.length === 0) {
            return {
                year_data: null,
                selected_audit_type_key: STATISTICS_FILTER_EMPTY_VALUE,
                labels_with_data: []
            };
        }
        const raw =
            params.auditType !== undefined && params.auditType !== null
                ? String(params.auditType).trim()
                : '';
        const selected_audit_type_key =
            raw && labels_with_data.includes(raw) ? raw : STATISTICS_FILTER_EMPTY_VALUE;
        const year_data = selected_audit_type_key ? pa[selected_audit_type_key] || null : null;
        return {
            year_data,
            selected_audit_type_key,
            labels_with_data
        };
    }

    _statistics_nav_params(year_num, monitoring_key, audit_type_key) {
        const out = { year: String(year_num) };
        if (monitoring_key) out.monitoringType = monitoring_key;
        if (audit_type_key) out.auditType = audit_type_key;
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

    _append_filter_placeholder_option(select_el, Helpers, t, selected) {
        select_el.appendChild(
            Helpers.create_element('option', {
                attributes: {
                    value: STATISTICS_FILTER_EMPTY_VALUE,
                    ...(selected ? { selected: 'selected' } : {})
                },
                text_content: t('statistics_filter_select_prompt')
            })
        );
    }

    _wire_statistics_monitoring_select(Helpers, t, years, monitoring_labels, selected_monitoring_key) {
        const type_field = Helpers.create_element('div', { class_name: 'statistics-filter-row__field' });
        type_field.appendChild(
            Helpers.create_element('label', {
                class_name: 'statistics-filter-row__label',
                attributes: { for: 'statistics-monitoring-select' },
                text_content: t('statistics_rulefile_type_label')
            })
        );
        this.monitoring_type_select_ref = Helpers.create_element('select', {
            id: 'statistics-monitoring-select',
            class_name: ['form-control', 'statistics-monitoring-select']
        });
        this._append_filter_placeholder_option(
            this.monitoring_type_select_ref,
            Helpers,
            t,
            !selected_monitoring_key
        );
        monitoring_labels.forEach((key) => {
            this.monitoring_type_select_ref.appendChild(
                Helpers.create_element('option', {
                    attributes: { value: key },
                    text_content: this._monitoring_heading(key)
                })
            );
        });
        this.monitoring_type_select_ref.value = selected_monitoring_key || STATISTICS_FILTER_EMPTY_VALUE;
        this.monitoring_type_select_ref.addEventListener('change', () => {
            const y = parseInt(this.year_select_ref?.value || '', 10);
            if (!years.includes(y)) return;
            const mk = this.monitoring_type_select_ref.value || '';
            if (!mk) {
                this.router('statistics', { year: String(y) });
                return;
            }
            this.router('statistics', this._statistics_nav_params(y, mk));
        });
        type_field.appendChild(this.monitoring_type_select_ref);
        return type_field;
    }

    _wire_statistics_audit_type_select(
        Helpers,
        t,
        years,
        monitoring_key,
        audit_labels,
        selected_audit_type_key,
        monitoring_selected
    ) {
        const type_field = Helpers.create_element('div', { class_name: 'statistics-filter-row__field' });
        type_field.appendChild(
            Helpers.create_element('label', {
                class_name: 'statistics-filter-row__label',
                attributes: { for: 'statistics-audit-type-select' },
                text_content: t('statistics_audit_type_label')
            })
        );
        this.audit_type_select_ref = Helpers.create_element('select', {
            id: 'statistics-audit-type-select',
            class_name: ['form-control', 'statistics-audit-type-select']
        });
        this._append_filter_placeholder_option(
            this.audit_type_select_ref,
            Helpers,
            t,
            !selected_audit_type_key
        );
        if (monitoring_selected) {
            audit_labels.forEach((key) => {
                this.audit_type_select_ref.appendChild(
                    Helpers.create_element('option', {
                        attributes: { value: key },
                        text_content: this._audit_type_heading(key)
                    })
                );
            });
        }
        this.audit_type_select_ref.value = selected_audit_type_key || STATISTICS_FILTER_EMPTY_VALUE;
        this.audit_type_select_ref.addEventListener('change', () => {
            const y = parseInt(this.year_select_ref?.value || '', 10);
            if (!years.includes(y)) return;
            const mk = this.monitoring_type_select_ref?.value || monitoring_key || '';
            const ak = this.audit_type_select_ref.value || '';
            if (!mk) return;
            if (!ak) {
                this.router('statistics', this._statistics_nav_params(y, mk));
                return;
            }
            this.router('statistics', this._statistics_nav_params(y, mk, ak));
        });
        type_field.appendChild(this.audit_type_select_ref);
        return type_field;
    }

    _append_filters_section(
        plate,
        t,
        Helpers,
        years,
        selected_year,
        monitoring_labels,
        selected_monitoring_key,
        audit_labels,
        selected_audit_type_key
    ) {
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
        row.appendChild(
            this._wire_statistics_monitoring_select(Helpers, t, years, monitoring_labels, selected_monitoring_key)
        );
        row.appendChild(
            this._wire_statistics_audit_type_select(
                Helpers,
                t,
                years,
                selected_monitoring_key,
                audit_labels,
                selected_audit_type_key,
                Boolean(selected_monitoring_key)
            )
        );
        section.appendChild(row);
        plate.appendChild(section);
    }

    _append_await_selection_message(plate, t, Helpers) {
        plate.appendChild(
            Helpers.create_element('p', {
                class_name: 'statistics-filters-await view-intro-text',
                text_content: t('statistics_filters_await_selection')
            })
        );
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
            attributes: { role: 'status', 'aria-busy': 'true' },
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

        const monitoring_resolved = this._resolve_monitoring_slice(year_raw, params);
        const monitoring_labels = monitoring_resolved.labels_with_data;
        const selected_monitoring_key = monitoring_resolved.selected_monitoring_key;

        if (monitoring_labels.length === 0) {
            plate.appendChild(
                Helpers.create_element('p', {
                    class_name: 'statistics-summary',
                    text_content: t('statistics_no_rulefile_types_for_year')
                })
            );
            return;
        }

        const audit_resolved = this._resolve_audit_type_slice(
            monitoring_resolved.monitoring_entry,
            params
        );
        const audit_labels = audit_resolved.labels_with_data;
        const selected_audit_type_key = audit_resolved.selected_audit_type_key;

        this._append_filters_section(
            plate,
            t,
            Helpers,
            years,
            selected,
            monitoring_labels,
            selected_monitoring_key,
            audit_labels,
            selected_audit_type_key
        );

        const slice_ready =
            Boolean(selected_monitoring_key) &&
            Boolean(selected_audit_type_key) &&
            audit_resolved.year_data;

        if (!slice_ready) {
            this._append_await_selection_message(plate, t, Helpers);
            return;
        }

        const year_data = audit_resolved.year_data;

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
