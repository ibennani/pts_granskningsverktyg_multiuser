/**
 * Vy för aggregerad statistik över avslutade granskningar.
 */
import { get_audit_statistics_summary } from '../api/client.js';
import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';
import './statistics_view_component.css';

const MONITORING_FALLBACK_SENTINEL = '__GV_STATS_MONITORING_FALLBACK__';

/** Samma ordning som serverns WCAG_PRINCIPLE_IDS. */
const WCAG_PRINCIPLE_ORDER = ['perceivable', 'operable', 'understandable', 'robust'];

export class StatisticsViewComponent {
    constructor() {
        this.CSS_PATH = './statistics_view_component.css';
        this.root = null;
        this.deps = null;
        this.Translation = null;
        this.Helpers = null;
        this.router = null;
        this.year_select_ref = null;
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

    /**
     * @param {HTMLElement} el
     * @param {object} Helpers
     * @param {{ text: string, strong: boolean }[]} text_fragments
     */
    _append_fragments_to_element(el, Helpers, text_fragments) {
        text_fragments.forEach((frag) => {
            if (frag.strong) {
                el.appendChild(Helpers.create_element('strong', { text_content: frag.text }));
            } else {
                el.appendChild(document.createTextNode(frag.text));
            }
        });
    }

    /**
     * Två punkter: antal slutförda granskningar, sedan mediantid eller att den saknas.
     * @param {function} t
     * @param {object} Helpers
     * @param {number} year
     * @param {object} year_data
     * @returns {HTMLElement}
     */
    _build_summary_list(t, Helpers, year, year_data) {
        const ul = Helpers.create_element('ul', { class_name: 'statistics-summary__list' });

        const li1 = Helpers.create_element('li', { class_name: 'statistics-summary__item' });
        this._append_fragments_to_element(li1, Helpers, [
            { text: t('statistics_summary_under_year', { year: String(year) }), strong: false },
            { text: this._completed_strong_text(t, year_data.completed_count), strong: true },
            { text: '.', strong: false }
        ]);
        ul.appendChild(li1);

        const li2 = Helpers.create_element('li', { class_name: 'statistics-summary__item' });
        const median = year_data.median_duration_weeks;
        if (median !== null && median !== undefined) {
            this._append_fragments_to_element(li2, Helpers, [
                { text: t('statistics_summary_median_word'), strong: true },
                { text: t('statistics_summary_median_between'), strong: false },
                {
                    text: t('statistics_summary_median_weeks_strong', { weeks: String(median) }),
                    strong: true
                },
                { text: '.', strong: false }
            ]);
        } else {
            li2.appendChild(document.createTextNode(t('statistics_summary_median_unknown_inline')));
        }
        ul.appendChild(li2);

        return ul;
    }

    /**
     * Samma visning som på granskningsöversikten (ScoreAnalysisComponent), med medianvärden från API.
     * @param {HTMLElement} plate
     * @param {function} t
     * @param {object} Helpers
     * @param {object} year_data
     */
    _append_score_analysis_block(plate, t, Helpers, year_data) {
        const pmd = year_data.principle_median_deficiency || {};
        const has_median_data = WCAG_PRINCIPLE_ORDER.some((id) => {
            const v = pmd[id];
            return v !== null && v !== undefined && !Number.isNaN(Number(v));
        });

        const section = Helpers.create_element('section', {
            class_name: 'statistics-score-analysis-section',
            attributes: { 'aria-labelledby': 'statistics-score-analysis-heading' }
        });
        section.appendChild(
            Helpers.create_element('h2', {
                id: 'statistics-score-analysis-heading',
                class_name: 'statistics-score-analysis-section__h2',
                text_content: t('statistics_principles_chart_heading')
            })
        );
        section.appendChild(
            Helpers.create_element('p', {
                class_name: 'statistics-score-analysis-section__intro view-intro-text',
                text_content: t('statistics_principles_chart_intro')
            })
        );

        if (!has_median_data) {
            section.appendChild(
                Helpers.create_element('p', {
                    class_name: 'statistics-score-analysis-section__empty',
                    text_content: t('statistics_principles_chart_empty')
                })
            );
            plate.appendChild(section);
            return;
        }

        const container = Helpers.create_element('div', {
            id: 'statistics-score-analysis-root',
            class_name: 'statistics-score-analysis-root'
        });
        section.appendChild(container);
        plate.appendChild(section);

        const completed = year_data.completed_count || 0;
        const get_override = () => {
            const principles = {};
            for (const id of WCAG_PRINCIPLE_ORDER) {
                const raw = pmd[id];
                const n =
                    raw !== null && raw !== undefined && !Number.isNaN(Number(raw)) ? Number(raw) : 0;
                principles[id] = { labelKey: id, score: n };
            }
            const tot = year_data.total_median_deficiency;
            const totalScore =
                tot !== null && tot !== undefined && !Number.isNaN(Number(tot)) ? Number(tot) : 0;
            return {
                totalScore,
                principles,
                sampleCount: completed,
                footnoteTranslationKey: 'statistics_score_based_on_completed_audits',
                footnoteParams: { count: completed }
            };
        };

        ScoreAnalysisComponent.init({
            root: container,
            deps: {
                Helpers,
                Translation: this.Translation,
                getState: () => ({ ruleFileContent: null, samples: [] }),
                getScoreAnalysisOverride: get_override
            }
        });
        ScoreAnalysisComponent.render();
    }

    _append_top_failed_block(plate, t, Helpers, sections) {
        plate.appendChild(
            Helpers.create_element('h2', {
                class_name: 'statistics-top-failed__h2',
                text_content: t('statistics_top_failed_heading')
            })
        );
        plate.appendChild(
            Helpers.create_element('p', {
                class_name: 'statistics-top-failed__intro view-intro-text',
                text_content: t('statistics_top_failed_intro')
            })
        );
        if (!sections.length) {
            plate.appendChild(
                Helpers.create_element('p', {
                    class_name: 'statistics-top-failed__empty',
                    text_content: t('statistics_top_failed_empty')
                })
            );
            return;
        }
        sections.forEach((sec) => {
            const h3 = Helpers.create_element('h3', {
                class_name: 'statistics-top-failed__h3',
                text_content: this._monitoring_heading(sec.monitoring_type_label)
            });
            plate.appendChild(h3);
            const ol = Helpers.create_element('ol', { class_name: 'statistics-top-failed__list' });
            sec.top_requirements.forEach((row) => {
                const li = Helpers.create_element('li', {});
                li.appendChild(
                    Helpers.create_element('strong', {
                        text_content: row.requirement_name
                    })
                );
                li.appendChild(document.createTextNode('. '));
                li.appendChild(
                    document.createTextNode(
                        t('statistics_req_fail_line_percent', {
                            percent: String(row.audit_fail_rate_percent),
                            count: String(row.audit_count)
                        })
                    )
                );
                ol.appendChild(li);
            });
            plate.appendChild(ol);
        });
    }

    _handle_year_change(selected_year, available_years) {
        const y = parseInt(selected_year, 10);
        if (!available_years.includes(y)) return;
        if (typeof this.router === 'function') {
            this.router('statistics', { year: String(y) });
        }
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

    _append_year_dropdown(plate, t, Helpers, years, selected) {
        const year_row = Helpers.create_element('div', { class_name: 'statistics-year-row form-group' });
        year_row.appendChild(
            Helpers.create_element('label', {
                attributes: { for: 'statistics-year-select' },
                text_content: t('statistics_year_label')
            })
        );
        this.year_select_ref = Helpers.create_element('select', {
            id: 'statistics-year-select',
            class_name: ['form-control', 'statistics-year-select'],
            attributes: { 'aria-label': t('statistics_year_label') }
        });
        years.forEach((y) => {
            this.year_select_ref.appendChild(
                Helpers.create_element('option', {
                    attributes: { value: String(y) },
                    text_content: String(y)
                })
            );
        });
        this.year_select_ref.value = String(selected);
        this.year_select_ref.addEventListener('change', (ev) => {
            this._handle_year_change(ev.target.value, years);
        });
        year_row.appendChild(this.year_select_ref);
        plate.appendChild(year_row);
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

        this._append_year_dropdown(plate, t, Helpers, years, selected);

        const per = data.per_year || {};
        const year_data = per[String(selected)] || {
            completed_count: 0,
            median_duration_weeks: null,
            monitoring_type_top_failed: [],
            principle_median_deficiency: {},
            total_median_deficiency: null
        };

        const summary_wrap = Helpers.create_element('section', {
            class_name: 'statistics-summary',
            attributes: { 'aria-labelledby': 'statistics-summary-heading' }
        });
        summary_wrap.appendChild(
            Helpers.create_element('h2', {
                id: 'statistics-summary-heading',
                text_content: t('statistics_summary_section_heading')
            })
        );
        summary_wrap.appendChild(this._build_summary_list(t, Helpers, selected, year_data));
        plate.appendChild(summary_wrap);

        this._append_score_analysis_block(plate, t, Helpers, year_data);

        this._append_top_failed_block(plate, t, Helpers, year_data.monitoring_type_top_failed || []);
    }
}
