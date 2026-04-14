import {
    DEFICIENCY_SCORE_ZONE_UPPER_BOUNDS,
    DEFICIENCY_ZONE_COLOR_CSS_VAR_NAMES,
    deficiency_score_bar_background_css_value,
    deficiency_score_bar_gradient_stops_only_css,
    get_deficiency_gauge_zone_boundary_degrees,
    inject_deficiency_score_bar_gradient_styles
} from '../../js/logic/deficiency_color_scale.ts';

describe('deficiency_color_scale', () => {
    test('zongränser och färgvariabler är definierade', () => {
        expect([...DEFICIENCY_SCORE_ZONE_UPPER_BOUNDS]).toEqual([15, 30, 45]);
        expect(DEFICIENCY_ZONE_COLOR_CSS_VAR_NAMES.length).toBe(4);
    });

    test('gradient-CS innehåller trösklar och tema-variabler', () => {
        const stops = deficiency_score_bar_gradient_stops_only_css();
        expect(stops).toContain('15%');
        expect(stops).toContain('30%');
        expect(stops).toContain('45%');
        expect(stops).toContain('--gradient-success-color');
        const full = deficiency_score_bar_background_css_value();
        expect(full.startsWith('linear-gradient')).toBe(true);
    });

    test('mätarvinklar följer zonprocent', () => {
        const [a, b, c] = get_deficiency_gauge_zone_boundary_degrees(0, 100);
        expect(a).toBe(15);
        expect(b).toBe(30);
        expect(c).toBe(45);
    });

    test('inject_deficiency_score_bar_gradient_styles är idempotent', () => {
        inject_deficiency_score_bar_gradient_styles();
        const n = document.head.querySelectorAll('#gv-deficiency-score-bar-gradient').length;
        inject_deficiency_score_bar_gradient_styles();
        expect(document.head.querySelectorAll('#gv-deficiency-score-bar-gradient').length).toBe(n);
    });
});
