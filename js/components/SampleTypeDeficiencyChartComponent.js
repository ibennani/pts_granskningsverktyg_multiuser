/**
 * Återanvändbar vy: staplar med median bristindex per stickprovstyp (samma utseende som statistiksidan).
 */
import {
    MONITORING_LABEL_FALLBACK_SENTINEL,
    build_sampletype_chart_sections_from_audit_state
} from '../logic/sample_type_deficiency_chart_data.ts';
import './statistics_view_component.css';

/**
 * Median bristindex i diagrammet: alltid exakt en decimal.
 * @param {number} n
 * @returns {string}
 */
function format_sampletype_chart_median_one_decimal(n) {
    const num = Number(n);
    if (Number.isNaN(num)) return '0.0';
    return num.toFixed(1);
}

/**
 * @param {HTMLElement} plate
 * @param {object} options
 * @param {object} options.Helpers
 * @param {string} options.heading_text
 * @param {string} options.intro_text
 * @param {object[]} options.chart_sections
 * @param {(label: string) => string} options.monitoring_heading_fn
 */
export function append_sampletype_deficiency_chart_block(plate, options) {
    const Helpers = options.Helpers;
    const sections = Array.isArray(options.chart_sections) ? options.chart_sections : [];
    if (sections.length === 0 || !Helpers?.create_element) return;

    const wrap = Helpers.create_element('div', { class_name: 'statistics-sampletype-chart' });
    wrap.appendChild(
        Helpers.create_element('h2', {
            class_name: 'statistics-sampletype-chart__h2',
            text_content: options.heading_text
        })
    );
    wrap.appendChild(
        Helpers.create_element('p', {
            class_name: 'view-intro-text statistics-sampletype-chart__intro',
            text_content: options.intro_text
        })
    );

    const monitoring_heading_fn = options.monitoring_heading_fn || ((x) => x);
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
            label_left.appendChild(
                Helpers.create_element('strong', {
                    text_content: format_sampletype_chart_median_one_decimal(val)
                })
            );
            li.appendChild(label_left);

            const track = Helpers.create_element('span', { class_name: 'statistics-sampletype-chart__track' });
            track.appendChild(
                Helpers.create_element('span', {
                    class_name: 'statistics-sampletype-chart__fill',
                    attributes: { style: `width: ${Math.min(100, Math.max(0, val))}%;` }
                })
            );
            li.appendChild(track);
            ul.appendChild(li);
        });
        wrap.appendChild(ul);
    });

    plate.appendChild(wrap);
}

export class SampleTypeDeficiencyChartComponent {
    constructor() {
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.getState = null;
    }

    /**
     * @param {{ root: HTMLElement, deps: { Helpers: object, Translation: object, getState: () => object } }} args
     */
    async init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.getState = deps.getState;
    }

    _monitoring_heading(raw) {
        const t = this.Translation.t;
        return raw === MONITORING_LABEL_FALLBACK_SENTINEL ? t('statistics_monitoring_fallback_label') : raw;
    }

    render() {
        if (!this.root || !this.Helpers?.create_element) return;
        this.root.innerHTML = '';
        const state = typeof this.getState === 'function' ? this.getState() : null;
        const sections = build_sampletype_chart_sections_from_audit_state(state);
        if (sections.length === 0) return;
        const t = this.Translation.t;
        append_sampletype_deficiency_chart_block(this.root, {
            Helpers: this.Helpers,
            heading_text: t('audit_overview_sampletype_chart_heading'),
            intro_text: t('audit_overview_sampletype_chart_intro'),
            chart_sections: sections,
            monitoring_heading_fn: (lbl) => this._monitoring_heading(lbl)
        });
    }

    destroy() {
        if (this.root) {
            while (this.root.firstChild) {
                this.root.removeChild(this.root.firstChild);
            }
            this.root.innerHTML = '';
        }
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.getState = null;
    }
}
