/**
 * Central konfiguration för bristindex 0–100: zongränser, färger och genererad CSS för staplar.
 * Ändra här så slår ändringar igenom i mätare, principrader och stickprovstypsdiagram (efter injektion vid start).
 */

/** Övre gräns för grön, gul respektive orange zon (över sista värdet rött). */
export const DEFICIENCY_SCORE_ZONE_UPPER_BOUNDS = [15, 30, 45] as const;

/**
 * CSS-variabelnamn per zon (fyra zoner). Byt till egna temavariabler här om du vill ändra färger globalt.
 * Måste finnas i temat (t.ex. theme.css).
 */
export const DEFICIENCY_ZONE_COLOR_CSS_VAR_NAMES = [
    '--gradient-success-color',
    '--gradient-warning-color',
    '--gradient-orange-color',
    '--gradient-danger-color'
] as const;

/** Procentuellt steg mellan zoner i linjär stapel (tidigare 15 % → 16 %). */
export const DEFICIENCY_ZONE_BAR_GAP_PERCENT = 1;

const INJECTED_STYLE_ELEMENT_ID = 'gv-deficiency-score-bar-gradient';

/**
 * Inre del av linear-gradient (utan linear-gradient(to right, ...)).
 */
export function deficiency_score_bar_gradient_stops_only_css(): string {
    const [u0, u1, u2] = DEFICIENCY_SCORE_ZONE_UPPER_BOUNDS;
    const g = DEFICIENCY_ZONE_BAR_GAP_PERCENT;
    const c = DEFICIENCY_ZONE_COLOR_CSS_VAR_NAMES;
    const v = (i: 0 | 1 | 2 | 3) => `var(${c[i]})`;
    return [
        `${v(0)} 0%`,
        `${v(0)} ${u0}%`,
        `${v(1)} ${u0 + g}%`,
        `${v(1)} ${u1}%`,
        `${v(2)} ${u1 + g}%`,
        `${v(2)} ${u2}%`,
        `${v(3)} ${u2 + g}%`,
        `${v(3)} 100%`
    ].join(',\n            ');
}

/**
 * Fullt `background`-värde för bristindex-staplar (samma som injiceras globalt).
 */
export function deficiency_score_bar_background_css_value(): string {
    return `linear-gradient(to right, ${deficiency_score_bar_gradient_stops_only_css()})`;
}

/**
 * Injicerar en gång: gemensam gradient + background-size för principrad och stickprovstyp-diagram.
 * Fyllnader under "Underkända krav" (samma klass men utanför .statistics-sampletype-chart) får inte gradienten.
 * Idempotent. Anropas från app-start (webbläsare).
 */
export function inject_deficiency_score_bar_gradient_styles(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById(INJECTED_STYLE_ELEMENT_ID)) return;

    const bg = deficiency_score_bar_background_css_value();
    const style = document.createElement('style');
    style.id = INJECTED_STYLE_ELEMENT_ID;
    style.textContent = `
.principle-row__bar,
.statistics-sampletype-chart .statistics-sampletype-chart__fill {
    background: ${bg};
    background-size: calc(100% / (var(--score-percent, 0.01) / 100)) 100%;
}
`;
    document.head.appendChild(style);
}

/**
 * Vinklar (grader) där mätarens färgzoner möts, för givet bågintervall.
 */
export function get_deficiency_gauge_zone_boundary_degrees(
    min_angle_deg: number,
    max_angle_deg: number
): readonly [number, number, number] {
    const span = max_angle_deg - min_angle_deg;
    const [a, b, c] = DEFICIENCY_SCORE_ZONE_UPPER_BOUNDS;
    return [
        min_angle_deg + (a / 100) * span,
        min_angle_deg + (b / 100) * span,
        min_angle_deg + (c / 100) * span
    ] as const;
}

/**
 * Stroke-färg för mätarsegment (CSS var-referens).
 */
export function deficiency_gauge_zone_stroke_css(zone_index: 0 | 1 | 2 | 3): string {
    return `var(${DEFICIENCY_ZONE_COLOR_CSS_VAR_NAMES[zone_index]})`;
}
