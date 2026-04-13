/**
 * Bygger DOM-block för statistikvyn (sammanfattning, diagram, topplistor).
 * @module js/components/statistics_view_sections
 */
import { ScoreAnalysisComponent } from './ScoreAnalysisComponent.js';

/** Samma ordning som serverns WCAG_PRINCIPLE_IDS. */
const WCAG_PRINCIPLE_ORDER = ['perceivable', 'operable', 'understandable', 'robust'];

/**
 * @param {HTMLElement} el
 * @param {object} Helpers
 * @param {{ text: string, strong: boolean }[]} text_fragments
 */
export function append_text_fragments_to_element(el, Helpers, text_fragments) {
    text_fragments.forEach((frag) => {
        if (frag.strong) {
            el.appendChild(Helpers.create_element('strong', { text_content: frag.text }));
        } else {
            el.appendChild(document.createTextNode(frag.text));
        }
    });
}

/**
 * @param {*} val
 * @returns {string|null}
 */
function format_median_number(val) {
    if (val === null || val === undefined || Number.isNaN(Number(val))) return null;
    const n = Number(val);
    if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
    return n.toFixed(1);
}

/**
 * Median bristindex i stickprovstyp-diagrammet: alltid exakt en decimal.
 * @param {number} n
 */
function format_sampletype_chart_median_one_decimal(n) {
    const num = Number(n);
    if (Number.isNaN(num)) return '0.0';
    return num.toFixed(1);
}

/**
 * @param {object} Translation
 * @param {*} val
 * @returns {string|null}
 */
function format_median_number_locale(Translation, val) {
    const lang =
        typeof Translation?.get_current_language_code === 'function'
            ? Translation.get_current_language_code()
            : 'sv-SE';
    if (val === null || val === undefined || Number.isNaN(Number(val))) return null;
    const n = Number(val);
    if (Math.abs(n - Math.round(n)) < 0.05) {
        return Math.round(n).toLocaleString(lang, { maximumFractionDigits: 0 });
    }
    return n.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * @param {function} t
 * @param {object} Translation
 * @param {object} Helpers
 * @param {number} year
 * @param {object} year_data
 * @param {function} completed_strong_fn (t, count) => string
 * @returns {HTMLElement}
 */
export function build_statistics_summary_list(t, Translation, Helpers, year, year_data, completed_strong_fn) {
    const ul = Helpers.create_element('ul', { class_name: 'statistics-summary__list' });

    const li1 = Helpers.create_element('li', { class_name: 'statistics-summary__item' });
    append_text_fragments_to_element(li1, Helpers, [
        { text: t('statistics_summary_under_year', { year: String(year) }), strong: false },
        { text: completed_strong_fn(t, year_data.completed_count), strong: true },
        { text: '.', strong: false }
    ]);
    ul.appendChild(li1);

    const li2 = Helpers.create_element('li', { class_name: 'statistics-summary__item' });
    const median = year_data.median_duration_weeks;
    if (median !== null && median !== undefined) {
        append_text_fragments_to_element(li2, Helpers, [
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

    const li3 = Helpers.create_element('li', { class_name: 'statistics-summary__item' });
    const med_samples = format_median_number(year_data.median_sample_count);
    if (med_samples !== null) {
        append_text_fragments_to_element(li3, Helpers, [
            { text: t('statistics_summary_median_samples_prefix'), strong: false },
            { text: med_samples, strong: true },
            { text: t('statistics_summary_median_samples_suffix'), strong: false }
        ]);
    } else {
        li3.appendChild(document.createTextNode(t('statistics_summary_median_samples_unknown')));
    }
    ul.appendChild(li3);

    const li4 = Helpers.create_element('li', { class_name: 'statistics-summary__item' });
    const worst = year_data.worst_sample_type;
    const worst_type = worst && typeof worst.sample_type_label === 'string'
        ? worst.sample_type_label.trim()
        : (worst && typeof worst.sample_type === 'string' ? worst.sample_type.trim() : '');
    const worst_score = worst && typeof worst.median_deficiency === 'number' ? worst.median_deficiency : null;
    if (worst_type) {
        append_text_fragments_to_element(li4, Helpers, [
            { text: t('statistics_summary_worst_sample_type_prefix'), strong: false },
            { text: worst_type, strong: true },
            ...(worst_score === null || Number.isNaN(Number(worst_score))
                ? [{ text: '.', strong: false }]
                : [
                      { text: t('statistics_summary_worst_sample_type_mid'), strong: false },
                      { text: format_median_number_locale(Translation, worst_score), strong: true },
                      { text: t('statistics_summary_worst_sample_type_suffix'), strong: false }
                  ])
        ]);
    } else {
        li4.appendChild(document.createTextNode(t('statistics_summary_worst_sample_type_unknown')));
    }
    ul.appendChild(li4);

    return ul;
}

/**
 * @param {HTMLElement} plate
 * @param {function} t
 * @param {object} Helpers
 * @param {object[]} chart_sections
 * @param {function} monitoring_heading_fn
 */
export function append_statistics_sampletype_chart_block(plate, t, Helpers, chart_sections, monitoring_heading_fn) {
    const sections = Array.isArray(chart_sections) ? chart_sections : [];
    if (sections.length === 0) return;

    const wrap = Helpers.create_element('div', { class_name: 'statistics-sampletype-chart' });
    wrap.appendChild(Helpers.create_element('h2', {
        class_name: 'statistics-sampletype-chart__h2',
        text_content: t('statistics_sampletype_chart_heading')
    }));
    wrap.appendChild(Helpers.create_element('p', {
        class_name: 'view-intro-text statistics-sampletype-chart__intro',
        text_content: t('statistics_sampletype_chart_intro')
    }));

    const show_per_type_heading = sections.length > 1;
    sections.forEach((sec) => {
        if (show_per_type_heading) {
            wrap.appendChild(
                Helpers.create_element('h3', {
                    class_name: 'statistics-sampletype-chart__h3',
                    text_content: monitoring_heading_fn(sec.monitoring_type_label)
                })
            );
        }

        const ul = Helpers.create_element('ul', { class_name: 'statistics-sampletype-chart__list' });
        (sec.sample_types || []).forEach((row) => {
            const li = Helpers.create_element('li', { class_name: 'statistics-sampletype-chart__item' });
            const val = typeof row.median_deficiency === 'number' ? row.median_deficiency : 0;
            const label_left = Helpers.create_element('span', { class_name: 'statistics-sampletype-chart__label' });
            label_left.appendChild(document.createTextNode(row.sample_type_label || row.sample_type_id || ''));
            label_left.appendChild(document.createTextNode(': '));
            label_left.appendChild(Helpers.create_element('strong', {
                text_content: format_sampletype_chart_median_one_decimal(val)
            }));
            li.appendChild(label_left);

            const track = Helpers.create_element('span', { class_name: 'statistics-sampletype-chart__track' });
            track.appendChild(Helpers.create_element('span', {
                class_name: 'statistics-sampletype-chart__fill',
                attributes: { style: `width: ${Math.min(100, Math.max(0, val))}%;` }
            }));
            li.appendChild(track);
            ul.appendChild(li);
        });
        wrap.appendChild(ul);
    });

    plate.appendChild(wrap);
}

/**
 * @param {HTMLElement} plate
 * @param {function} t
 * @param {object} Helpers
 * @param {object} Translation
 * @param {object} year_data
 */
export function append_statistics_score_analysis_block(plate, t, Helpers, Translation, year_data) {
    const pmd = year_data.principle_median_deficiency || {};
    const has_median_data = WCAG_PRINCIPLE_ORDER.some((id) => {
        const v = pmd[id];
        return v !== null && v !== undefined && !Number.isNaN(Number(v));
    });

    const section = Helpers.create_element('div', {
        class_name: 'statistics-score-analysis-section'
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
            Translation,
            getState: () => ({ ruleFileContent: null, samples: [] }),
            getScoreAnalysisOverride: get_override
        }
    });
    ScoreAnalysisComponent.render();
}

/**
 * @param {HTMLElement} plate
 * @param {function} t
 * @param {object} Helpers
 * @param {object[]} sections
 * @param {function} monitoring_heading_fn
 */
export function append_statistics_top_failed_block(plate, t, Helpers, sections, monitoring_heading_fn) {
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
    const show_per_type_heading = sections.length > 1;
    sections.forEach((sec) => {
        if (show_per_type_heading) {
            plate.appendChild(
                Helpers.create_element('h3', {
                    class_name: 'statistics-top-failed__h3',
                    text_content: monitoring_heading_fn(sec.monitoring_type_label)
                })
            );
        }
        const ol = Helpers.create_element('ol', { class_name: 'statistics-top-failed__list' });
        sec.top_requirements.forEach((row) => {
            const li = Helpers.create_element('li', {
                class_name: 'statistics-top-failed__item'
            });
            li.appendChild(
                Helpers.create_element('strong', {
                    text_content: row.requirement_name
                })
            );
            const pct = Math.min(
                100,
                Math.max(0, Number(row.audit_fail_rate_percent) || 0)
            );
            const meta_line = t('statistics_req_fail_meta_line', {
                percent: String(row.audit_fail_rate_percent),
                count: String(row.audit_count)
            });
            const meta_row = Helpers.create_element('div', {
                class_name: 'statistics-top-failed__meta-row'
            });
            meta_row.appendChild(
                Helpers.create_element('span', {
                    class_name: 'statistics-top-failed__meta-count',
                    text_content: meta_line
                })
            );
            const track = Helpers.create_element('span', {
                class_name: 'statistics-sampletype-chart__track',
                attributes: { 'aria-hidden': 'true' }
            });
            track.appendChild(
                Helpers.create_element('span', {
                    class_name: 'statistics-sampletype-chart__fill',
                    attributes: { style: `width: ${pct}%;` }
                })
            );
            meta_row.appendChild(track);
            li.appendChild(meta_row);
            ol.appendChild(li);
        });
        plate.appendChild(ol);
    });
}
