import { DEFICIENCY_SCORE_ZONE_UPPER_BOUNDS } from '../../js/logic/deficiency_color_scale.ts';

describe('deficiency_color_scale', () => {
    test('zongränser följer 15 / 30 / 45 för bristindex', () => {
        expect([...DEFICIENCY_SCORE_ZONE_UPPER_BOUNDS]).toEqual([15, 30, 45]);
    });
});
