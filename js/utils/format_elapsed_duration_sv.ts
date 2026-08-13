/**
 * @fileoverview Formaterar förfluten tid på svenska för import-sammanfattningar.
 */

export function format_elapsed_duration_sv(elapsed_ms: number): string {
    const total_seconds = Math.max(0, Math.round(elapsed_ms / 1000));
    const minutes = Math.floor(total_seconds / 60);
    const seconds = total_seconds % 60;

    if (minutes > 0 && seconds > 0) {
        return `${minutes} ${minutes === 1 ? 'minut' : 'minuter'} och ${seconds} ${seconds === 1 ? 'sekund' : 'sekunder'}`;
    }
    if (minutes > 0) {
        return `${minutes} ${minutes === 1 ? 'minut' : 'minuter'}`;
    }
    return `${seconds} ${seconds === 1 ? 'sekund' : 'sekunder'}`;
}
