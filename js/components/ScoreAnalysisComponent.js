import "../../css/components/score_analysis_component.css";

export const ScoreAnalysisComponent = {
    init({ root, deps }) {
        this.root = root;
        this.deps = deps;
        this.Helpers = deps.Helpers;
        this.Translation = deps.Translation;
        this.getState = deps.getState;
        this.ScoreCalculator = deps.ScoreCalculator;
    },
    
    _performAnalysis() {
        // Function name is kept for compatibility, but it now returns a deficiency index
        return this.ScoreCalculator.calculateQualityScore(this.getState());
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

        // Calculate angles for each percentage range
        const totalAngle = maxAngle - minAngle; // 270 degrees
        const greenEndAngle = minAngle + (15 / 100) * totalAngle; // 15% of 270° = 40.5°
        const yellowEndAngle = minAngle + (30 / 100) * totalAngle; // 30% of 270° = 81°
        const orangeEndAngle = minAngle + (45 / 100) * totalAngle; // 45% of 270° = 121.5°

        const svgContent = `
            <svg viewBox="0 0 100 85" class="score-gauge-svg">
                <!-- Gauge track (background) -->
                <path class="score-gauge__track" d="${describeArc(50, 50, 40, minAngle, maxAngle)}" />
                
                <!-- Gauge segments with straight boundaries -->
                ${createGaugeSegment(minAngle, greenEndAngle, 'var(--gradient-success-color)')}
                ${createGaugeSegment(greenEndAngle, yellowEndAngle, 'var(--gradient-warning-color)')}
                ${createGaugeSegment(yellowEndAngle, orangeEndAngle, 'var(--gradient-orange-color)')}
                ${createGaugeSegment(orangeEndAngle, maxAngle, 'var(--gradient-danger-color)')}
                
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
        let analysis = this._performAnalysis();
        
        // Fallback: graferna ska alltid vara synliga även innan något granskats.
        if (!analysis) {
            const safe_sample_count = this.getState()?.samples?.length || 0;
            analysis = {
                totalScore: 0,
                principles: {
                    perceivable: { labelKey: 'perceivable', score: 0 },
                    operable: { labelKey: 'operable', score: 0 },
                    understandable: { labelKey: 'understandable', score: 0 },
                    robust: { labelKey: 'robust', score: 0 }
                },
                sampleCount: safe_sample_count
            };
        }

        const main_container = this.Helpers.create_element('div', { class_name: 'score-analysis-content' });

        const totalScoreContainer = this.Helpers.create_element('div', { class_name: 'score-analysis-total' });
        
        totalScoreContainer.appendChild(this.Helpers.create_element('h3', { 
            class_name: 'score-analysis-total__title',
            text_content: t('deficiency_index_title', {defaultValue: "Deficiency Index"})
        }));

        const scoreVisualization = this.Helpers.create_element('div', { class_name: 'score-analysis-total__visualization' });
        
        const gaugeWrapper = this.Helpers.create_element('div', { class_name: 'score-gauge-wrapper' });
        gaugeWrapper.innerHTML = this._createGaugeSVG(analysis.totalScore, lang_code);
        
        const scoreContext = this.Helpers.create_element('div', { class_name: 'score-analysis-total__context' });
        scoreContext.appendChild(this.Helpers.create_element('p', { class_name: 'score-analysis-total__subtext', text_content: `(${t('lower_is_better', {defaultValue: "Lower is better"})})` }));
        scoreContext.appendChild(this.Helpers.create_element('p', { class_name: 'score-analysis-total__info', text_content: t('based_on_samples', { count: analysis.sampleCount, defaultValue: `Based on ${analysis.sampleCount} audited samples.`}) }));
        
        scoreVisualization.appendChild(gaugeWrapper);
        scoreVisualization.appendChild(scoreContext);
        totalScoreContainer.appendChild(scoreVisualization);
        main_container.appendChild(totalScoreContainer);

        const principlesContainer = this.Helpers.create_element('div', { class_name: 'score-analysis-principles' });
        principlesContainer.appendChild(this.Helpers.create_element('h3', { 
            class_name: 'score-analysis-principles__title',
            text_content: t('score_by_principle_deficiency', {defaultValue: "Breakdown by Principle"})
        }));

        const dl = this.Helpers.create_element('dl', { class_name: 'score-analysis-principles__list' });

        const default_order = ['perceivable', 'operable', 'understandable', 'robust'];
        const principle_ids = Object.keys(analysis.principles || {});
        const ordered_principle_ids = default_order.every(id => principle_ids.includes(id))
            ? default_order
            : principle_ids;

        for (const principleId of ordered_principle_ids) {
            const data = analysis.principles[principleId];
            
            const row = this.Helpers.create_element('div', { class_name: 'principle-row' });
            const label_text = data?.labelKey ? t(data.labelKey) : (data?.label || '');
            const dt = this.Helpers.create_element('dt', { class_name: 'principle-row__name', text_content: label_text });
            
            const dd = this.Helpers.create_element('dd', { class_name: 'principle-row__bar-container' });
            
            const formattedScoreForAria = this.Helpers.format_number_locally(data.score, lang_code);
            
            const bar = this.Helpers.create_element('div', {
                class_name: 'principle-row__bar',
                attributes: {
                    style: `width: ${Math.min(data.score, 100)}%;`,
                    role: 'meter',
                    'aria-valuenow': data.score,
                    'aria-valuemin': '0',
                    'aria-valuemax': '100',
                    'aria-label': t('deficiency_index_for_principle', { principle: label_text, score: formattedScoreForAria, defaultValue: `Deficiency index for ${label_text}: ${formattedScoreForAria} out of 100` })
                }
            });
            bar.style.setProperty('--score-percent', data.score);

            const valueSpan = this.Helpers.create_element('span', { class_name: 'principle-row__value', text_content: this.Helpers.format_number_locally(data.score, lang_code) });
            
            dd.appendChild(bar);
            dd.appendChild(valueSpan);
            row.appendChild(dt);
            row.appendChild(dd);
            dl.appendChild(row);
        }
        
        principlesContainer.appendChild(dl);
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
        this.ScoreCalculator = null;
    }
};
