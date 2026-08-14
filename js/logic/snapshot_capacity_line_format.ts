/**
 * @fileoverview Formaterar kapacitetstext med korrekt singular/plural per språk.
 */

export type SnapshotCapacityLineInput = {
    active_count: number;
    queued_count: number;
    active_user_count: number;
};

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

function format_active_segment(t: TranslationFn, active: number): string {
    if (active === 1) {
        return t('snapshot_capacity_active_one');
    }
    return t('snapshot_capacity_active_many', { active });
}

function format_queued_segment(t: TranslationFn, queued: number): string {
    if (queued === 1) {
        return t('snapshot_capacity_queued_one');
    }
    return t('snapshot_capacity_queued_many', { queued });
}

function format_other_users_segment(t: TranslationFn, users: number): string {
    if (users === 1) {
        return t('snapshot_capacity_other_users_one');
    }
    return t('snapshot_capacity_other_users_many', { users });
}

export function format_snapshot_capacity_line(
    t: TranslationFn,
    capacity: SnapshotCapacityLineInput,
    queue_position: number | null
): string {
    const active = capacity.active_count;
    const queued = capacity.queued_count;
    const other_users = Math.max(0, capacity.active_user_count - 1);

    let main_line: string;
    if (active <= 0 && queued <= 0 && other_users <= 0) {
        main_line = t('snapshot_capacity_idle');
    } else {
        const parts: string[] = [];
        if (active > 0) {
            parts.push(format_active_segment(t, active));
        }
        if (other_users > 0) {
            parts.push(format_other_users_segment(t, other_users));
        }
        if (queued > 0) {
            parts.push(format_queued_segment(t, queued));
        }
        main_line = parts.length > 0 ? parts.join(' ') : t('snapshot_capacity_idle');
    }

    if (queue_position !== null && queue_position > 0) {
        return `${main_line} ${t('snapshot_queue_position', { position: queue_position })}`;
    }
    return main_line;
}
