/**
 * @fileoverview Enhetstester för snapshot-kapacitetstext (singular/plural).
 */
import { format_snapshot_capacity_line } from '../../js/logic/snapshot_capacity_line_format.ts';
import sv from '../../js/i18n/sv-SE.json';

type TranslationParams = Record<string, unknown>;

function sv_t(key: string, params?: TranslationParams): string {
    let text = (sv as Record<string, string>)[key] ?? key;
    if (params) {
        for (const [name, value] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
        }
    }
    return text;
}

const base_capacity = {
    active_count: 0,
    queued_count: 0,
    active_user_count: 1,
};

describe('format_snapshot_capacity_line', () => {
    test('en aktiv sida använder singular', () => {
        const line = format_snapshot_capacity_line(sv_t, {
            ...base_capacity,
            active_count: 1,
        }, null);
        expect(line).toBe('1 sida hämtas just nu.');
    });

    test('flera aktiva sidor använder plural', () => {
        const line = format_snapshot_capacity_line(sv_t, {
            ...base_capacity,
            active_count: 3,
        }, null);
        expect(line).toBe('3 sidor hämtas just nu.');
    });

    test('en annan användare använder singular', () => {
        const line = format_snapshot_capacity_line(sv_t, {
            ...base_capacity,
            active_count: 1,
            active_user_count: 2,
        }, null);
        expect(line).toBe('1 sida hämtas just nu. 1 annan användare hämtar också.');
    });

    test('kö med en sida använder singular', () => {
        const line = format_snapshot_capacity_line(sv_t, {
            ...base_capacity,
            active_count: 2,
            queued_count: 1,
        }, null);
        expect(line).toBe('2 sidor hämtas just nu. 1 sida väntar i kön.');
    });
});
