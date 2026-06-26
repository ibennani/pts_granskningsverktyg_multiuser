import {
    DEFAULT_MIN_BACKUPS,
    compute_retention_cutoff_time,
    select_entries_for_retention_deletion
} from '../../server/backup/backup_retention.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-26T12:00:00.000Z');

function days_ago(days) {
    return NOW.getTime() - days * DAY_MS;
}

function make_entries(count, { all_old = false, old_count = 0 } = {}) {
    const entries = [];
    for (let i = 0; i < count; i++) {
        const is_old = all_old || i >= count - old_count;
        const age_days = is_old ? 40 + (count - 1 - i) : i;
        entries.push({
            id: `file-${i}`,
            mtimeMs: days_ago(age_days)
        });
    }
    return entries;
}

describe('backup_retention', () => {
    test('DEFAULT_MIN_BACKUPS är 5', () => {
        expect(DEFAULT_MIN_BACKUPS).toBe(5);
    });

    test('8 filer, 3 äldre än cutoff — raderar 3 äldsta', () => {
        const entries = make_entries(8, { old_count: 3 });
        const to_delete = select_entries_for_retention_deletion(entries, {
            retention_days: 30,
            now: NOW
        });
        expect(to_delete).toHaveLength(3);
        expect(to_delete).toEqual(['file-7', 'file-6', 'file-5']);
    });

    test('7 filer, alla äldre än cutoff — raderar 2 äldsta, behåller 5', () => {
        const entries = make_entries(7, { all_old: true });
        const to_delete = select_entries_for_retention_deletion(entries, {
            retention_days: 30,
            now: NOW
        });
        expect(to_delete).toHaveLength(2);
        expect(to_delete).toEqual(['file-1', 'file-0']);
    });

    test('3 filer, alla äldre än cutoff — raderar inget', () => {
        const entries = make_entries(3, { all_old: true });
        const to_delete = select_entries_for_retention_deletion(entries, {
            retention_days: 30,
            now: NOW
        });
        expect(to_delete).toEqual([]);
    });

    test('5 filer, 1 äldre än cutoff — raderar inget (skyddad bland de 5 nyaste)', () => {
        const entries = [
            { id: 'new-1', mtimeMs: days_ago(1) },
            { id: 'new-2', mtimeMs: days_ago(2) },
            { id: 'new-3', mtimeMs: days_ago(3) },
            { id: 'new-4', mtimeMs: days_ago(4) },
            { id: 'old-5', mtimeMs: days_ago(40) }
        ];
        const to_delete = select_entries_for_retention_deletion(entries, {
            retention_days: 30,
            now: NOW
        });
        expect(to_delete).toEqual([]);
    });

    test('min_count 0 — endast åldersgräns gäller', () => {
        const entries = make_entries(3, { all_old: true });
        const to_delete = select_entries_for_retention_deletion(entries, {
            retention_days: 30,
            min_count: 0,
            now: NOW
        });
        expect(to_delete).toHaveLength(3);
    });

    test('tom lista returnerar inget', () => {
        expect(select_entries_for_retention_deletion([], { retention_days: 30, now: NOW })).toEqual([]);
    });

    test('compute_retention_cutoff_time subtraherar dagar från now', () => {
        const cutoff = compute_retention_cutoff_time(30, NOW);
        expect(cutoff).toBe(days_ago(30));
    });
});
