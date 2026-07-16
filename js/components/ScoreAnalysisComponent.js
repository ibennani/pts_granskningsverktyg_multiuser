import { calculateQualityScore } from '../logic/ScoreCalculator.js';
import {
    deficiency_gauge_zone_stroke_css,
    get_deficiency_gauge_zone_boundary_degrees
} from '../logic/deficiency_color_scale.js';
import {
    get_primary_grouping_taxonomy_id,
    sort_concept_ids_for_display,
    WCAG_PRINCIPLE_FALLBACK_ORDER,
} from '../../shared/classification/taxonomy_grouping.js';
import "./score_analysis_component.css";

export const ScoreAnalysisComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.getState = deps.getState;
        /** @type {null|(() => object|null)} */
        this.getScoreAnalysisOverride = deps.getScoreAnalysisOverride ?? null;
    },

    _performAnalysis() {
        // Function name is kept for compatibility, but it now returns a deficiency index.
        // calculateQualityScore importeras direkt så render inte kraschar om deps.ScoreCalculator
        // saknas efter destroy eller vid omritning före init (singleton-livscykel).
        return calculateQualityScore(this.getState());
    },

    _createGaugeSVG(value, lang_code) {
        const minAngle = -135;
        const maxAngle = 135;
        // Invert the angle calculation for deficiency index
        const angle = minAngle + (value / 100) * (maxAngle - minAngle);

        const formattedValue = this.Helpers.format_number_locally(value, lang_code);

        // const gradientId = `gaugeGradient-${this.Helpers.generate_uuid_v4()}`; // Unused var

        const describeArc = (x, y, radius, startAngle, endAngle) => {
            const start = polarToCartesian(x, y, radius, endAngle);
            const end = polarToCartesian(x, y, radius, startAngle);
            const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
            return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
        };

        const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
            const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
            return {
                x: centerX + (radius * Math.cos(angleInRadians)),
                y: centerY + (radius * Math.sin(angleInRadians))
            };
        };

        // Create gauge segments with different colors and straight boundaries
        const createGaugeSegment = (startAngle, endAngle, color) => {
            return `<path d="${describeArc(50, 50, 40, startAngle, endAngle)}" stroke="${color}" stroke-width="10" stroke-linecap="butt" fill="none" />`;
        };

        const [greenEndAngle, yellowEndAngle, orangeEndAngle] = get_deficiency_gauge_zone_boundary_degrees(
            minAngle,
            maxAngle
        );

        const svgContent = `
            <svg viewBox="0 0 100 85" class="score-gauge-svg" aria-hidden="true">
                <!-- Gauge track (background) -->
                <path class="score-gauge__track" d="${describeArc(50, 50, 40, minAngle, maxAngle)}" />
                
                <!-- Gauge segments with straight boundaries -->
                ${createGaugeSegment(minAngle, greenEndAngle, deficiency_gauge_zone_stroke_css(0))}
                ${createGaugeSegment(greenEndAngle, yellowEndAngle, deficiency_gauge_zone_stroke_css(1))}
                ${createGaugeSegment(yellowEndAngle, orangeEndAngle, deficiency_gauge_zone_stroke_css(2))}
                ${createGaugeSegment(orangeEndAngle, maxAngle, deficiency_gauge_zone_stroke_css(3))}
                
                <!-- Value text -->
                <text x="50" y="55" class="score-gauge__value">${formattedValue}</text>

                <!-- Marker -->
                <g class="score-gauge__marker-group" transform="rotate(${angle} 50 50)">
                    <circle class="score-gauge__marker" cx="50" cy="10" r="4" />
                </g>
            </svg>
        `;

        return svgContent;
    },

    render() {
        if (!this.root) return;
        this.root.innerHTML = '';
        
        const t = this.Translation.t;
        const lang_code = this.Translation.get_current_language_code();
        let analysis =
            typeof this.getScoreAnalysisOverride === 'function'
                ? this.getScoreAnalysisOverride()
                : null;
        if (!analysis || typeof analysis !== 'object') {
            analysis = this._performAnalysis();
        }

        // Fallback: graferna ska alltid vara synliga även innan något granskats.
        if (!analysis) {
            const safe_sample_count = this.getState()?.samples?.length || 0;
            const rule_content = this.getState()?.ruleFileContent;
            const empty_principles = calculateQualityScore({
                ruleFileContent: rule_content,
                samples: [],
            }).principles;
            analysis = {
                totalScore: 0,
                principles: empty_principles,
                sampleCount: safe_sample_count
            };
        }

        const main_container = this.Helpers.create_element('div', { class_name: 'score-analysis-content' });

        const totalScoreContainer = this.Helpers.create_element('div', { class_name: 'score-analysis-total' });
        
        totalScoreContainer.appendChild(this.Helpers.create_element('h3', { 
            class_name: 'score-analysis-total__title',
            text_content: t('deficiency_index_title', {defaultValue: "Deficiency Index"})
        }));

        const formatted_total_score = this.Helpers.format_number_locally(analysis.totalScore, lang_code);
        const screen_reader_value = `${t('deficiency_index_title', {defaultValue: "Deficiency Index"})}: ${formatted_total_score}`;
        totalScoreContainer.appendChild(this.Helpers.create_element('span', {
            class_name: 'visually-hidden',
            text_content: screen_reader_value
        }));

        const scoreVisualization = this.Helpers.create_element('div', { class_name: 'score-analysis-total__visualization' });
        
        const gaugeWrapper = this.Helpers.create_element('div', { class_name: 'score-gauge-wrapper' });
        gaugeWrapper.innerHTML = this._createGaugeSVG(analysis.totalScore, lang_code);
        
        const scoreContext = this.Helpers.create_element('div', { class_name: 'score-analysis-total__context' });
        scoreContext.appendChild(this.Helpers.create_element('p', { class_name: 'score-analysis-total__subtext', text_content: `(${t('lower_is_better', {defaultValue: "Lower is better"})})` }));
        const footnote_info =
            analysis.footnoteTranslationKey && typeof analysis.footnoteTranslationKey === 'string'
                ? t(analysis.footnoteTranslationKey, {
                      ...(analysis.footnoteParams || {}),
                      defaultValue: ''
                  })
                : t('based_on_samples', {
                      count: analysis.sampleCount,
                      defaultValue: `Based on ${analysis.sampleCount} audited samples.`
                  });
        scoreContext.appendChild(
            this.Helpers.create_element('p', { class_name: 'score-analysis-total__info', text_content: footnote_info })
        );
        
        scoreVisualization.appendChild(gaugeWrapper);
        scoreVisualization.appendChild(scoreContext);
        totalScoreContainer.appendChild(scoreVisualization);
        main_container.appendChild(totalScoreContainer);

        const principlesContainer = this.Helpers.create_element('div', { class_name: 'score-analysis-principles' });
        principlesContainer.appendChild(this.Helpers.create_element('h3', {
            class_name: 'score-analysis-principles__title',
            text_content: t('score_by_principle_deficiency', {defaultValue: "Breakdown by Principle"})
        }));

        const list_container = this.Helpers.create_element('ul', { class_name: 'score-analysis-principles__list' });

        const rule_content = this.getState()?.ruleFileContent;
        const taxonomy_id = get_primary_grouping_taxonomy_id(rule_content);
        const principle_ids = Object.keys(analysis.principles || {});
        let ordered_principle_ids = sort_concept_ids_for_display(
            principle_ids,
            rule_content?.metadata,
            taxonomy_id
        );
        if (ordered_principle_ids.length === 0) {
            ordered_principle_ids = [...WCAG_PRINCIPLE_FALLBACK_ORDER];
        }

        for (const principleId of ordered_principle_ids) {
            const data = analysis.principles[principleId];
            if (!data) continue;

            const label_text = data?.labelKey ? t(data.labelKey) : (data?.label || '');
            const formattedScore = this.Helpers.format_number_locally(data.score, lang_code);

            const row = this.Helpers.create_element('li', {
                class_name: 'principle-row'
            });

            const name_div = this.Helpers.create_element('div', { class_name: 'principle-row__name', text_content: label_text });

            const bar_container = this.Helpers.create_element('div', { class_name: 'principle-row__bar-container' });

            const bar = this.Helpers.create_element('div', {
                class_name: 'principle-row__bar',
                attributes: {
                    style: `width: ${Math.min(data.score, 100)}%;`,
                    'aria-hidden': 'true'
                }
            });
            bar.style.setProperty('--score-percent', data.score);

            const valueSpan = this.Helpers.create_element('span', {
                class_name: 'principle-row__value',
                text_content: formattedScore
            });

            bar_container.appendChild(bar);
            bar_container.appendChild(valueSpan);
            row.appendChild(name_div);
            row.appendChild(bar_container);
            list_container.appendChild(row);
        }

        principlesContainer.appendChild(list_container);
        main_container.appendChild(principlesContainer);
        this.root.appendChild(main_container);
    },

    destroy() {
        if (this.root) {
            // Clear all child elements to prevent memory leaks
            while (this.root.firstChild) {
                this.root.removeChild(this.root.firstChild);
            }
            this.root.innerHTML = '';
        }
        
        // Nullify all references to help with garbage collection
        this.root = null;
        this.deps = null;
        this.Helpers = null;
        this.Translation = null;
        this.getState = null;
        this.getScoreAnalysisOverride = null;
    }
};
