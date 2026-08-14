import {
    should_skip_beskrivning,
} from '../../scripts/nabu_ha_cursor_klar_event.mjs';

describe('nabu_ha_cursor_klar_event', () => {
    test('should_skip_beskrivning filtrerar tom och generisk text', () => {
        expect(should_skip_beskrivning('')).toBe(true);
        expect(should_skip_beskrivning('Öppna Cursor och läs senaste svaret.')).toBe(true);
        expect(should_skip_beskrivning('Hooken fungerar nu.')).toBe(false);
    });
});
